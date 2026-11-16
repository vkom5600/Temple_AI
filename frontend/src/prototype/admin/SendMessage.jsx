import { useState } from 'react'
import { sendLinks } from '../lib'
import { Icon, Modal, CopyButton, Avatar } from '../ui.jsx'

// A drafted message, editable, with one-tap send buttons per recipient.
// For now each button opens WhatsApp / the text app / email with the message filled in, and the
// person presses send there. Later the backend sends it directly (WhatsApp Business API or Twilio).
export default function SendMessage({ title, draft, recipients, onSent, onClose }) {
  const [text, setText] = useState(draft)
  const sent = (how, who) => onSent?.(`${how} to ${who.name}`)

  return (
    <Modal title={title} onClose={onClose} wide footer={<><CopyButton text={text} /><button className="btn btn-ghost" onClick={onClose}>Done</button></>}>
      <p className="muted small">Drafted for you. Edit if needed, then choose how to send it.</p>
      <textarea className="draft" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="send-list">
        {recipients.map((u) => {
          const l = sendLinks(u, text)
          return (
            <div key={u.id} className="send-row">
              <Avatar user={u} size={30} />
              <div className="grow">
                <div>{u.name}</div>
                <div className="meta">{[u.phone, u.email].filter(Boolean).join(' · ') || 'No phone or email. Add them on the People page.'}</div>
              </div>
              <div className="send-btns">
                {l.whatsapp && <a className="btn btn-sm btn-wa" href={l.whatsapp} target="_blank" rel="noreferrer" onClick={() => sent('WhatsApp', u)}>WhatsApp</a>}
                {l.sms && <a className="btn btn-sm btn-outline" href={l.sms} onClick={() => sent('Text', u)}>Text</a>}
                {l.email && <a className="btn btn-sm btn-outline" href={l.email} onClick={() => sent('Email', u)}>Email</a>}
              </div>
            </div>
          )
        })}
        {!recipients.length && <p className="muted">Nobody is in this role yet.</p>}
      </div>
      <p className="muted small"><Icon name="bell" size={14} /> Later this sends automatically (WhatsApp Business or Twilio text, still to decide). Staff will also get an app notification.</p>
    </Modal>
  )
}
