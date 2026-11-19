import { Section, FormRow, Label, Field, Btn, Msg } from "./ui";
import LogPreview from "./LogPreview";

const INTERVALS = [[1, "1 second"], [5, "5 seconds"], [10, "10 seconds"], [30, "30 seconds"], [60, "1 minute"], [300, "5 minutes"], [3600, "1 hour"]];

export default function LoggingPanel({ T, logging }) {
  const { logSt, logInterval, setLogInterval, logMsg, preview, startLog, stopLog, clearLog, download } = logging;

  return (
    <Section T={T} i={3} title="Data logging" note="Save PLC values to CSV / Excel · last 15 rows shown">
      <FormRow>
        <Label T={T} text="Log every">
          <Field T={T} value={logInterval} onChange={(e) => setLogInterval(Number(e.target.value))} disabled={logSt.active}>
            {INTERVALS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Field>
        </Label>
        {logSt.active
          ? <Btn T={T} onClick={stopLog}>Stop logging</Btn>
          : <Btn T={T} primary onClick={startLog}>Start logging</Btn>}
        <Btn T={T} onClick={() => download("xlsx")}>Download Excel (.xlsx)</Btn>
        <Btn T={T} onClick={() => download("csv")}>Download CSV</Btn>
        <Btn T={T} onClick={clearLog}>Clear log</Btn>
        <Msg T={T}>
          {logSt.active ? `Logging every ${logSt.interval} s` : "Logging is off"} · {logSt.rows} rows saved.
          {" "}Rows are saved only while a PLC (or DEMO) is connected. {logMsg}
        </Msg>
      </FormRow>
      <LogPreview T={T} preview={preview} />
    </Section>
  );
}