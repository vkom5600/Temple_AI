
import pool from "../config/db.js";
import { createAuditLog } from "../services/auditService.js";
import {
  sendNotificationSafely,
  notifyRolesSafely
} from "../services/notificationService.js";

// Create a booking request
export const createBooking = async (req, res) => {
  try {
    const {
      booking_type,
      resource_name,
      event_title,
      start_at,
      end_at,
      notes
    } = req.body;

    if (
      !booking_type ||
      !resource_name ||
      !start_at ||
      !end_at
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking type, resource, start time and end time are required"
      });
    }

    if (!["hall", "room", "event"].includes(booking_type)) {
      return res.status(400).json({
        success: false,
        message: "Booking type must be hall, room or event"
      });
    }

    const start = new Date(start_at);
    const end = new Date(end_at);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid dates and an end time after the start time"
      });
    }

    const result = await pool.query(
      `INSERT INTO bookings
       (booking_type, resource_name, event_title,
        booked_by, start_at, end_at, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
       RETURNING *`,
      [
        booking_type,
        resource_name,
        event_title || null,
        req.user.id,
        start_at,
        end_at,
        notes || null
      ]
    );
try {
  await createAuditLog({
    actorId: req.user.id,
    action: "BOOKING_CREATED",
    entityType: "booking",
    entityId: result.rows[0].id,
    details: {
      resourceName: result.rows[0].resource_name,
      eventTitle: result.rows[0].event_title,
      bookingType: result.rows[0].booking_type,
      startAt: result.rows[0].start_at,
      endAt: result.rows[0].end_at
    }
  });
} catch (auditError) {
  console.error("Booking creation audit error:", auditError);
}
await notifyRolesSafely({
  roles: ["chairman", "committee"],
  title: "New Booking Request",
  message: `A new ${result.rows[0].booking_type} booking request was submitted: ${result.rows[0].event_title} for ${result.rows[0].resource_name}.`
});
    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully",
      booking: result.rows[0]
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create booking"
    });
  }
};

// View bookings
export const getBookings = async (req, res) => {
  try {
    const { status, booking_type } = req.query;

    let query = `
      SELECT b.*, u.full_name AS booked_by_name
      FROM bookings b
      JOIN users u ON b.booked_by = u.id
      WHERE 1=1
    `;

    const values = [];

    // Non-management users see only their own bookings
    if (!["chairman", "committee"].includes(req.user.role)) {
      values.push(req.user.id);
      query += ` AND b.booked_by = $${values.length}`;
    }

    if (status) {
      values.push(status);
      query += ` AND b.status = $${values.length}`;
    }

    if (booking_type) {
      values.push(booking_type);
      query += ` AND b.booking_type = $${values.length}`;
    }

    query += " ORDER BY b.start_at DESC";

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rowCount,
      bookings: result.rows
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve bookings"
    });
  }
};

// Approve or reject a booking
export const reviewBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { decision } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be approved or rejected"
      });
    }

    await client.query("BEGIN");

    // Lock this booking while it is reviewed
    const bookingResult = await client.query(
      `SELECT * FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be reviewed"
      });
    }

    // Check for overlapping approved bookings
    if (decision === "approved") {
      const conflict = await client.query(
        `SELECT id FROM bookings
         WHERE resource_name = $1
           AND status = 'approved'
           AND start_at < $2
           AND end_at > $3
           AND id <> $4
         LIMIT 1`,
        [
          booking.resource_name,
          booking.end_at,
          booking.start_at,
          id
        ]
      );

      if (conflict.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "This resource already has an overlapping approved booking"
        });
      }
    }

    const result = await client.query(
      `UPDATE bookings
       SET status = $1,
           approved_by = $2
       WHERE id = $3
       RETURNING *`,
      [decision, req.user.id, id]
    );

    await client.query("COMMIT");
    await sendNotificationSafely({
  userId: result.rows[0].booked_by,
  title: decision === "approved"
    ? "Booking Approved"
    : "Booking Rejected",
  message: decision === "approved"
    ? `Your booking "${result.rows[0].event_title}" for ${result.rows[0].resource_name} has been approved.`
    : `Your booking "${result.rows[0].event_title}" for ${result.rows[0].resource_name} has been rejected.`
});
    try {
  await createAuditLog({
    actorId: req.user.id,
    action: decision === "approved"
      ? "BOOKING_APPROVED"
      : "BOOKING_REJECTED",
    entityType: "booking",
    entityId: result.rows[0].id,
    details: {
      resourceName: result.rows[0].resource_name,
      eventTitle: result.rows[0].event_title,
      decision,
      startAt: result.rows[0].start_at,
      endAt: result.rows[0].end_at
    }
  });
} catch (auditError) {
  console.error("Booking review audit error:", auditError);
}

    res.json({
      success: true,
      message: `Booking ${decision} successfully`,
      booking: result.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Review booking error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to review booking"
    });
  } finally {
    client.release();
  }
};

// User cancels their own pending booking
export const cancelBooking = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE id = $1
         AND booked_by = $2
         AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Booking not found or cannot be cancelled"
      });
    }
try {
  await createAuditLog({
    actorId: req.user.id,
    action: "BOOKING_CANCELLED",
    entityType: "booking",
    entityId: result.rows[0].id,
    details: {
      resourceName: result.rows[0].resource_name,
      eventTitle: result.rows[0].event_title
    }
  });
} catch (auditError) {
  console.error("Booking cancellation audit error:", auditError);
}
    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking: result.rows[0]
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to cancel booking"
    });
  }
};
