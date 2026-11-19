/* Small shared pieces used by more than one panel. Styles are inline. */

export function Section({ T, i, title, note, children }) {
  return (
    <section style={{ background: i % 2 ? T.panel2 : T.panel, borderBottom: `1px solid ${T.line}`, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 6px" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: `linear-gradient(${T.acc2}, ${T.acc})` }} />
          {title}
        </h2>
        {note && <span style={{ fontSize: ".82rem", color: T.mute }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

/* Row that holds the form fields / buttons */
export function FormRow({ children }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", padding: "14px 20px 20px" }}>
      {children}
    </div>
  );
}

export function Label({ T, text, children }) {
  return (
    <label style={{
      display: "flex", flexDirection: "column", gap: 5, fontSize: ".8rem", fontWeight: 500,
      color: T.mute, flex: "1 1 150px", minWidth: 0,
    }}>
      {text}
      {children}
    </label>
  );
}

/* <select> (default) or <input> - pass as="input" */
export function Field({ T, as: Tag = "select", ...props }) {
  return (
    <Tag
      {...props}
      style={{
        font: "inherit", color: T.ink, background: T.bg, border: `1px solid ${T.line}`,
        borderRadius: 8, padding: "10px 11px", width: "100%", minWidth: 0,
      }}
    />
  );
}

export function Btn({ T, primary, children, ...props }) {
  const base = {
    flex: "1 1 150px", font: "inherit", cursor: "pointer", borderRadius: 8, padding: "10px 16px",
  };
  const style = primary
    ? {
        ...base, fontWeight: 600, border: `1px solid ${T.acc}`, color: T.onacc,
        background: `linear-gradient(180deg, ${T.acc2}, ${T.acc})`, boxShadow: `0 2px 10px ${T.acc}55`,
      }
    : { ...base, fontWeight: 500, border: `1px solid ${T.line}`, background: T.bg, color: T.ink };
  return <button type="button" style={style} {...props}>{children}</button>;
}

export function Msg({ T, err, children }) {
  return <p style={{ flex: "0 0 100%", margin: 0, fontSize: ".85rem", color: err ? T.err : T.mute }}>{children}</p>;
}