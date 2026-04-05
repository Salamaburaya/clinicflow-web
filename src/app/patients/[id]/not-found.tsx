import Link from "next/link";

export default function PatientRecordNotFound() {
  return (
    <main className="page-shell">
      <section className="content">
        <article className="card patient-route-state-card">
          <p className="section-tag">תיק מטופל</p>
          <h2>לא מצאנו את המטופל הזה</h2>
          <p className="item-meta">
            ייתכן שהמטופל נמחק, עדיין לא נשמר בשרת, או שהלינק כבר לא עדכני.
          </p>
          <div className="patient-route-state-actions">
            <Link className="primary-btn" href="/patients">
              חזרה למאגר המטופלים
            </Link>
            <Link className="ghost-btn inline-link-btn" href="/">
              חזרה ללוח הבקרה
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
