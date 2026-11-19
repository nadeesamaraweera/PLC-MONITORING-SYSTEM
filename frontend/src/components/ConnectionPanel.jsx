import { Section, FormRow, Label, Field, Btn, Msg } from "./ui";

export default function ConnectionPanel({ T, plc }) {
  const {
    models, ports, model, port, baud, parity, slave, connected, data, msg,
    setPort, setBaud, setParity, setSlave, onModel, loadPorts, connect, disconnect,
  } = plc;

  return (
    <Section T={T} i={0} title="PLC connection" note="Modbus RTU">
      <FormRow>
        <Label T={T} text="PLC model">
          <Field T={T} value={model} onChange={(e) => onModel(e.target.value)}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Field>
        </Label>
        <Label T={T} text="Port">
          <Field T={T} value={port} onChange={(e) => setPort(e.target.value)}>
            {/* keep the saved port visible even when the cable is unplugged */}
            {port && !ports.some((p) => p.port === port) && <option value={port}>{port} (not found)</option>}
            {ports.map((p) => <option key={p.port} value={p.port}>{p.label}</option>)}
          </Field>
        </Label>
        <Btn T={T} onClick={loadPorts}>Refresh ports</Btn>
        <Label T={T} text="Baud rate">
          <Field T={T} value={baud} onChange={(e) => setBaud(e.target.value)}>
            {[9600, 19200, 38400, 57600, 115200].map((b) => <option key={b}>{b}</option>)}
          </Field>
        </Label>
        <Label T={T} text="Parity">
          <Field T={T} value={parity} onChange={(e) => setParity(e.target.value)}>
            <option value="N">None</option>
            <option value="E">Even</option>
            <option value="O">Odd</option>
          </Field>
        </Label>
        <Label T={T} text="Slave ID">
          <Field T={T} as="input" type="number" min="1" max="247" value={slave} onChange={(e) => setSlave(e.target.value)} />
        </Label>
        {connected
          ? <Btn T={T} onClick={disconnect}>Disconnect</Btn>
          : <Btn T={T} primary onClick={() => connect()}>Connect</Btn>}
        <Msg T={T} err={!!data?.error}>{data?.error || msg}</Msg>
      </FormRow>
    </Section>
  );
}