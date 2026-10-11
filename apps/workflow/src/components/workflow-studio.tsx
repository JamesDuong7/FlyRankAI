"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, type Node, type Edge, type NodeChange, type Connection, type NodeProps } from "@xyflow/react";
import { useRealtime } from "inngest/react";
import { Plus, Play, Save, Upload, Download, Trash2, CircleDot, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { progressChannel } from "@/inngest/channels";
import { exampleWorkflow, migrateStarterWorkflow, validateWorkflow, type Workflow, type Branch } from "@/lib/workflow";
import "@xyflow/react/dist/style.css";

type DecisionData = { label: string; prompt: string; isStart: boolean; status: "idle" | "active" | "complete" | "failed" };
type DecisionNode = Node<DecisionData, "decision">;
type Progress = { runId: string; sequence: number; kind: "started" | "decision" | "branch" | "completed" | "failed"; nodeId?: string; edgeId?: string; decision?: Branch; message: string };
const storageKey = "flyrank-workflow-v1";

function DecisionCard({ data }: NodeProps<DecisionNode>) {
  return <div className={`decision-card ${data.status}`}>
    <Handle type="target" position={Position.Left} />
    <div className="node-heading"><span>{data.isStart ? "START" : "DECISION"}</span><span className={`status-dot ${data.status}`} /></div>
    <strong>{data.label}</strong><p>{data.prompt}</p>
    <div className="node-outputs"><span>YES</span><span>NO</span></div>
    <Handle id="YES" type="source" position={Position.Right} style={{ top: "72%", background: "#26b596" }} />
    <Handle id="NO" type="source" position={Position.Right} style={{ top: "88%", background: "#ef7979" }} />
  </div>;
}
const nodeTypes = { decision: DecisionCard };

function LiveStudio({ sessionId }: { sessionId: string }) {
  const [graph, setGraph] = useState<Workflow>(exampleWorkflow);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(exampleWorkflow.startNodeId);
  const [input, setInput] = useState("Bug report: In version 2.4.1 on Chrome, clicking Save in the invoice editor makes all unsaved line items disappear. Steps: create an invoice, add two line items, then click Save. Expected: the invoice keeps both items. Actual: the editor reloads with a blank invoice and the entries cannot be recovered.");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { connectionStatus, messages } = useRealtime({
    channel: progressChannel({ sessionId }), topics: ["progress"] as const,
    token: async () => {
      const response = await fetch("/api/token");
      if (!response.ok) throw new Error("Cannot subscribe to run updates.");
      return response.json();
    },
    autoCloseOnTerminal: false,
  });
  const progress = useMemo(() => messages.all.map((message) => message.data as Progress).filter((item) => item.runId === runId).sort((a, b) => a.sequence - b.sequence), [messages.all, runId]);
  const latest = progress.at(-1);
  const finished = latest?.kind === "completed" || latest?.kind === "failed";
  const running = Boolean(runId && !finished);
  const activeEdge = [...progress].reverse().find((item) => item.kind === "branch")?.edgeId ?? null;

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const restored = migrateStarterWorkflow(validateWorkflow(JSON.parse(saved)));
          setGraph(restored); setSelectedId(restored.startNodeId);
        }
      } catch { setError("Saved workflow was invalid; the example was loaded."); }
      setLoaded(true);
    });
  }, []);
  useEffect(() => { if (loaded) { try { localStorage.setItem(storageKey, JSON.stringify(validateWorkflow(graph))); } catch { /* Keep the last valid saved graph while a prompt is being edited. */ } } }, [graph, loaded]);

  const statusByNode = useMemo(() => {
    const result = new Map<string, DecisionData["status"]>();
    for (const event of progress) {
      if (event.kind === "started" && event.nodeId) result.set(event.nodeId, "active");
      if (event.kind === "decision" && event.nodeId) result.set(event.nodeId, "complete");
      if (event.kind === "failed") {
        const active = [...result.entries()].findLast((entry) => entry[1] === "active");
        if (active) result.set(active[0], "failed");
      }
    }
    return result;
  }, [progress]);
  const nodes: DecisionNode[] = useMemo(() => graph.nodes.map((node) => ({ id: node.id, type: "decision", position: node.position, initialWidth: 245, initialHeight: 164, deletable: false, data: { label: node.label, prompt: node.prompt, isStart: node.id === graph.startNodeId, status: statusByNode.get(node.id) ?? "idle" } })), [graph, statusByNode]);
  const edges: Edge[] = useMemo(() => graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.branch, label: edge.branch, animated: edge.id === activeEdge && running, style: { stroke: edge.id === activeEdge ? "#8c9fff" : edge.branch === "YES" ? "#26b596" : "#ef7979", strokeWidth: edge.id === activeEdge ? 3 : 2 }, labelStyle: { fill: "#dbe5f1", fontWeight: 700 }, labelBgStyle: { fill: "#172234" } })), [graph.edges, activeEdge, running]);

  const onNodesChange = useCallback((changes: NodeChange<DecisionNode>[]) => {
    const persistent = changes.filter((change) => change.type === "position");
    if (!persistent.length) return;
    const changed = applyNodeChanges(persistent, nodes);
    setGraph((current) => ({ ...current, nodes: current.nodes.map((node) => ({ ...node, position: changed.find((item) => item.id === node.id)?.position ?? node.position })) }));
  }, [nodes]);
  const connect = useCallback((connection: Connection) => {
    const branch = connection.sourceHandle as Branch;
    if (!connection.source || !connection.target || !["YES", "NO"].includes(branch)) return;
    try {
      const candidate = { ...graph, edges: [...graph.edges, { id: crypto.randomUUID(), source: connection.source, target: connection.target, branch }] };
      validateWorkflow(candidate);
      setGraph(candidate); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [graph]);
  const addNode = () => {
    const id = crypto.randomUUID();
    setGraph((current) => ({ ...current, nodes: [...current.nodes, { id, label: `Decision ${current.nodes.length + 1}`, prompt: "Is this true for the case?", position: { x: 150 + current.nodes.length * 35, y: 140 + current.nodes.length * 35 } }] }));
    setSelectedId(id); setNotice("");
  };
  const updateSelected = (key: "label" | "prompt", value: string) => setGraph((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, [key]: value } : node) }));
  const deleteSelected = () => {
    if (!selectedId || graph.nodes.length < 2) return;
    const remaining = graph.nodes.filter((node) => node.id !== selectedId);
    setGraph((current) => ({ ...current, startNodeId: current.startNodeId === selectedId ? remaining[0].id : current.startNodeId, nodes: remaining, edges: current.edges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId) }));
    setSelectedId(remaining[0].id);
  };
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(validateWorkflow(graph))); setNotice("Workflow saved in this browser."); setError(""); } catch (cause) { setError((cause as Error).message); } };
  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(validateWorkflow(graph), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "workflow.json"; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError((cause as Error).message); }
  };
  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = validateWorkflow(JSON.parse(await file.text()));
      setGraph(imported); setSelectedId(imported.startNodeId); setRunId(null); setError(""); setNotice("Workflow imported.");
    } catch (cause) { setError(`Import failed: ${(cause as Error).message}`); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const run = async () => {
    setError(""); setNotice("");
    try {
      const valid = validateWorkflow(graph);
      if (!input.trim()) throw new Error("Enter case text before running.");
      if (connectionStatus !== "open") throw new Error("Waiting for the live Inngest connection. Check the Dev Server.");
      const id = crypto.randomUUID(); setRunId(id); setPending(true);
      const response = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: id, workflow: valid, input: input.trim() }) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not start workflow.");
    } catch (cause) { setRunId(null); setError((cause as Error).message); }
    finally { setPending(false); }
  };
  const selected = graph.nodes.find((node) => node.id === selectedId);

  return <div className="studio">
    <header className="topbar"><div className="brand"><div className="brand-mark"><CircleDot size={20} /></div><div><h1>FlyRank Workflow Studio</h1><p>Visual AI decision flows</p></div></div><div className="toolbar"><span className={`connection ${connectionStatus === "open" ? "online" : ""}`}>{connectionStatus === "open" ? "Live" : `Inngest: ${connectionStatus}`}</span><Button variant="ghost" onClick={save}><Save size={16} /> Save</Button><Button variant="ghost" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import</Button><Button variant="ghost" onClick={exportJson}><Download size={16} /> Export</Button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importJson(event.target.files?.[0])} /><Button onClick={run} disabled={pending || running || connectionStatus !== "open"}><Play size={16} /> {running ? "Running" : "Run workflow"}</Button></div></header>
    <div className="workspace"><aside className="sidebar"><div className="panel-heading"><div><span className="eyebrow">WORKFLOW</span><h2>Build your flow</h2></div><Button variant="outline" onClick={addNode} aria-label="Add node"><Plus size={16} /></Button></div><p className="muted">Connect the YES and NO ports. Select a node to edit its decision prompt.</p><div className="node-list">{graph.nodes.map((node, index) => <button key={node.id} className={`node-list-item ${selectedId === node.id ? "selected" : ""}`} onClick={() => setSelectedId(node.id)}><span className="node-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{node.label}</strong><small>{node.id === graph.startNodeId ? "Start node" : "Decision node"}</small></span></button>)}</div><div className="sidebar-bottom"><strong>How it works</strong><p>Each visited node asks the model a yes/no question about your case. An unconnected answer ends the run.</p></div></aside>
    <main className="canvas-wrap"><div className="canvas-banner"><div><span className="eyebrow">CANVAS</span><h2>Decision map</h2></div><span>{graph.nodes.length} nodes · {graph.edges.length} connections</span></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={connect} onNodeClick={(_, node) => setSelectedId(node.id)} onEdgesChange={(changes) => setGraph((current) => ({ ...current, edges: current.edges.filter((edge) => !changes.some((change) => change.type === "remove" && change.id === edge.id)) }))} fitView fitViewOptions={{ padding: 0.25 }} proOptions={{ hideAttribution: true }}><Background color="#334155" gap={24} size={1} /><MiniMap pannable zoomable nodeColor="#5968c7" maskColor="rgba(9,15,27,.6)" /><Controls /></ReactFlow><div className="canvas-tip">Drag from a YES or NO port to connect nodes. Select an edge and press Delete to remove it.</div></main>
    <aside className="inspector"><section><span className="eyebrow">INSPECTOR</span><h2>{selected ? "Decision node" : "Select a node"}</h2>{selected && <><label>Node name<input value={selected.label} maxLength={80} onChange={(event) => updateSelected("label", event.target.value)} /></label><label>Decision prompt<textarea value={selected.prompt} maxLength={2000} rows={5} onChange={(event) => updateSelected("prompt", event.target.value)} /></label><p className="hint">The model evaluates this question against the case text and returns YES or NO.</p><div className="inspector-actions"><Button variant="outline" onClick={() => setGraph((current) => ({ ...current, startNodeId: selected.id }))} disabled={selected.id === graph.startNodeId}><CircleDot size={15} /> Set as start</Button><Button variant="destructive" onClick={deleteSelected} disabled={graph.nodes.length < 2}><Trash2 size={15} /></Button></div></>}</section><section className="run-panel"><span className="eyebrow">TEST RUN</span><h2>Evaluate a case</h2><label>Case text<textarea value={input} maxLength={5000} rows={5} onChange={(event) => setInput(event.target.value)} placeholder="Describe the request or situation to evaluate..." /></label>{error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice">{notice}</div>}<div className="run-status"><span className={`status-dot ${latest?.kind === "failed" ? "failed" : running ? "active" : latest?.kind === "completed" ? "complete" : "idle"}`} />{latest?.message ?? "No run yet"}</div></section><section className="logs-panel"><div className="log-title"><div><span className="eyebrow">EXECUTION</span><h2>Run log</h2></div><Button variant="ghost" aria-label="Clear run log" onClick={() => { setRunId(null); }}><RotateCcw size={16} /></Button></div>{progress.length ? <ol>{progress.map((entry) => <li key={`${entry.runId}-${entry.sequence}`}><span>{entry.kind}</span><p>{entry.message}</p></li>)}</ol> : <p className="muted">Run a workflow to see each step and branch here.</p>}</section></aside></div>
  </div>;
}

export default function WorkflowStudio() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => { fetch("/api/session").then((response) => { if (!response.ok) throw new Error("Could not create a local session."); return response.json(); }).then((data) => setSessionId(data.sessionId)).catch((error) => setSessionError(error.message)); }, []);
  if (sessionError) return <main className="boot-error">{sessionError}</main>;
  if (!sessionId) return <main className="boot-error">Preparing workflow studio…</main>;
  return <LiveStudio sessionId={sessionId} />;
}
