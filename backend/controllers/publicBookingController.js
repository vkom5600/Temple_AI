import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { chairmanEmails, sendEmail } from "../services/emailService.js";
import * as emails from "../services/emailTemplates.js";
import { checkBooking, findBooking, findClashes, requesterRules } from "../services/bookingService.js";
import { validateBooking } from "./bookingController.js";

// W1 Book a hall or room (public, no sign-in). Same rules as the phone request (M7):
// every "asked when booking" Temple Rule must be ticked, and nothing is booked until
// the chairman or a committee member approves it in the Action Center.

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const PHONE = /^[+\d][\d\s()-]{6,24}$/;

// GET /api/public/booking-options   the halls and rooms, and the rules to agree to
export const options = async (req, res) => {
    const resources = (await pool.query(
        `SELECT id, name, kind, capacity FROM resources WHERE is_active AND kind IN ('hall', 'room') ORDER BY sort_order, name`
    )).rows;
    res.json({ success: true, resources, rules: await requesterRules() });
};

// POST /api/public/check   { resource_id, starts_at, ends_at, guests }   is it free?
export const check = async (req, res) => {
    const resourceId = Number(req.body?.resource_id);
    const start = new Date(req.body?.starts_at);
    const end = new Date(req.body?.ends_at);
    if (!resourceId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return fail(res, 400, "Choose a space and a valid time");
    const resource = (await pool.query("SELECT * FROM resources WHERE id = $1 AND is_active", [resourceId])).rows[0];
    if (!resource) return fail(res, 404, "That hall or room isn't available");
    const c = await checkBooking({ resource_id: resourceId, resource_capacity: resource.capacity, starts_at: start, ends_at: end, guests: Number(req.body?.guests) || null, source: "desk", rules_agreed: [] });
    // Only say whether it's free and what breaks a rule; never show other people's bookings
    res.json({ success: true, free: c.free, problems: c.problems.filter((p) => !p.startsWith("clashes")) });
};

// POST /api/public/bookings   the request
export const create = async (req, res) => {
    const body = req.body ?? {};
    const contactName = typeof body.contact_name === "string" ? body.contact_name.trim() : "";
    const contactPhone = typeof body.contact_phone === "string" ? body.contact_phone.trim() : "";
    if (!contactName) return fail(res, 400, "Add your name");
    if (!PHONE.test(contactPhone)) return fail(res, 400, "Add a mobile number we can call");
    if (body.website) return fail(res, 400, "Couldn't send that"); // hidden field: only bots fill it in

    const visitor = { role: "public", full_name: contactName, phone: contactPhone };
    const { data, error } = await validateBooking({ ...body, kind: "booking" }, visitor);
    if (error) return fail(res, 400, error);

    const rules = await requesterRules();
    const missing = rules.filter((r) => !data.rules_agreed.includes(r.id));
    if (missing.length) return fail(res, 400, `Please agree to all ${rules.length} Temple Rules first`);

    const client = await pool.connect();
    let booking;
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(42, $1)", [data.resource_id]);
        if ((await findClashes(data.resource_id, data.starts_at, data.ends_at, null, client)).length) {
            await client.query("ROLLBACK");
            return fail(res, 409, `${data.resource.name} is already booked at that time. Please choose another time or space.`);
        }
        const inserted = await client.query(
            `INSERT INTO bookings (resource_id, kind, title, starts_at, ends_at, guests, food, contact_name, contact_phone,
                                   contact_email, organisation, notes, status, source, requested_by, rules_agreed, rules_agreed_at)
             VALUES ($1, 'booking', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 'web', NULL, $12, NOW())
             RETURNING id`,
            [data.resource_id, data.title, data.starts_at, data.ends_at, data.guests, data.food, contactName, contactPhone,
             data.contact_email, data.organisation, data.notes, JSON.stringify(data.rules_agreed)]
        );
        booking = await findBooking(inserted.rows[0].id, client);
        await logAudit({ actorId: null, action: "booking.requested_web", entityType: "booking", entityId: booking.id, details: { title: booking.title, resource: booking.resource_name, starts_at: booking.starts_at, contact: contactName } }, client);
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }

    notify({ roles: ["chairman", "committee"], title: `Booking request: ${booking.title}`, message: `${contactName} (website) · ${booking.resource_name}`, type: "booking" });
    chairmanEmails().then((to) => to.length && sendEmail({ to, ...emails.bookingRequested(booking) })).catch(() => {});

    const year = new Date(booking.created_at).getFullYear();
    res.status(201).json({
        success: true,
        reference: `IHC-${year}-${String(booking.id).padStart(4, "0")}`,
        booking: { title: booking.title, resource_name: booking.resource_name, starts_at: booking.starts_at, ends_at: booking.ends_at, guests: booking.guests },
        message: "The committee will call you once it's decided. Nothing is booked until then."
    });
};
