import { useMemo, useState } from 'react';
import { firestorePaths } from '../firebase/firestorePaths';
import { firestoreSandboxPaths, isSandboxCollectionAllowed } from '../firebase/firestoreSandboxPaths';
import {
  createSandboxTestDoc,
  getFirebaseSandboxHealth,
  listSandboxTestDocs,
  readSandboxTestDoc,
  runSandboxConnectivityCheck,
  softDeleteSandboxTestDoc,
  updateSandboxTestDoc
} from '../firebase/firestoreSandboxRepository';
import type { FirebaseSandboxResult } from '../firebase/firestoreSandboxTypes';

export default function FirebaseSandboxPanel() {
  const [vendorId, setVendorId] = useState('SCI-LOG-ZW');
  const [title, setTitle] = useState('Sandbox Connectivity Test');
  const [message, setMessage] = useState('Manual Firebase sandbox test from Sync Desk.');
  const [testNumber, setTestNumber] = useState('1');
  const [selectedCollection, setSelectedCollection] = useState(firestoreSandboxPaths.globalRepositoryTests());
  const [selectedDocId, setSelectedDocId] = useState('');
  const [result, setResult] = useState<FirebaseSandboxResult | null>(null);
  const [blockedMessage, setBlockedMessage] = useState('');

  const health = getFirebaseSandboxHealth();
  const vendorNotesPath = useMemo(() => firestoreSandboxPaths.vendorSandboxNotes(vendorId || 'SCI-LOG-ZW'), [vendorId]);

  const applyResult = (nextResult: FirebaseSandboxResult) => {
    setResult(nextResult);
    if (nextResult.docId) setSelectedDocId(nextResult.docId);
    if (nextResult.rows?.[0]?.id) setSelectedDocId(nextResult.rows[0].id);
  };

  const createDoc = async (collectionPath: string, source: string) => {
    setSelectedCollection(collectionPath);
    applyResult(await createSandboxTestDoc({
      collectionPath,
      vendorId: collectionPath.startsWith('vendors/') ? vendorId : undefined,
      title,
      message,
      testNumber: Number(testNumber || 0),
      source
    }));
  };

  const testBusinessBlock = () => {
    const businessPath = firestorePaths.productMaster(vendorId || 'SCI-LOG-ZW');
    const allowed = isSandboxCollectionAllowed(businessPath);
    setBlockedMessage(allowed ? 'Unexpected: business path was allowed.' : 'Blocked - business collections are disabled in this sandbox build.');
  };

  return (
    <section className="bg-white border-2 border-[#b1b5c2]">
      <div className="bg-[#1e222b] text-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p className="text-[9px] text-orange-400 uppercase font-black">Firebase Sandbox</p>
          <h2 className="text-sm font-black uppercase">Sandbox Collections Only</h2>
          <p className="text-[10px] text-slate-200 font-bold uppercase">Test Firestore connectivity using sandbox collections only. Business POS data remains on mock/local services.</p>
        </div>
        <span className={`px-2 py-1 border text-[9px] font-black uppercase ${health.firestoreAvailable ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-orange-50 border-orange-400 text-orange-900'}`}>
          {health.firestoreAvailable ? 'Firestore Shell Ready' : 'Firestore Not Ready'}
        </span>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <Metric label="Firebase Config" value={health.configured ? 'Ready' : 'Missing'} />
          <Metric label="Firestore App" value={health.firestoreAvailable ? 'Ready' : 'Not Ready'} />
          <Metric label="Sandbox Reads" value={health.sandboxReadsEnabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Sandbox Writes" value={health.sandboxWritesEnabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Business Reads" value={health.businessReadsEnabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Business Writes" value={health.businessWritesEnabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Last Sandbox Result" value={result?.status || health.lastResult?.status || 'None'} />
        </div>

        <div className="border border-orange-200 bg-orange-50 p-3 text-[10px] text-orange-950 font-bold uppercase">
          Only sandbox test collections are used here. Sales, payments, inventory, customers, delivery, approvals, and accounting are not connected to Firestore yet.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Input label="Vendor ID" value={vendorId} onChange={setVendorId} />
          <Input label="Test Title" value={title} onChange={setTitle} />
          <Input label="Test Message" value={message} onChange={setMessage} />
          <Input label="Test Number" value={testNumber} onChange={setTestNumber} type="number" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Input label="Selected Collection" value={selectedCollection} onChange={setSelectedCollection} />
          <Input label="Selected Doc ID" value={selectedDocId} onChange={setSelectedDocId} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Action label="Run Connectivity Check" onClick={async () => applyResult(await runSandboxConnectivityCheck())} primary />
          <Action label="Create Global Test Doc" onClick={() => void createDoc(firestoreSandboxPaths.globalRepositoryTests(), 'Global Sandbox Test')} />
          <Action label="Create Vendor Sandbox Note" onClick={() => void createDoc(vendorNotesPath, 'Vendor Sandbox Note')} />
          <Action label="List Global Test Docs" onClick={async () => { setSelectedCollection(firestoreSandboxPaths.globalRepositoryTests()); applyResult(await listSandboxTestDocs(firestoreSandboxPaths.globalRepositoryTests())); }} />
          <Action label="List Vendor Sandbox Notes" onClick={async () => { setSelectedCollection(vendorNotesPath); applyResult(await listSandboxTestDocs(vendorNotesPath)); }} />
          <Action label="Read Selected Test Doc" onClick={async () => applyResult(await readSandboxTestDoc(selectedCollection, selectedDocId))} />
          <Action label="Update Selected Test Doc" onClick={async () => applyResult(await updateSandboxTestDoc(selectedCollection, selectedDocId, { message, title, testNumber: Number(testNumber || 0), notes: 'Updated from Firebase Sandbox panel.' }))} />
          <Action label="Soft Delete Selected Test Doc" onClick={async () => applyResult(await softDeleteSandboxTestDoc(selectedCollection, selectedDocId))} />
          <Action label="Test Business Collection Block" onClick={testBusinessBlock} />
        </div>

        {blockedMessage && <div className="border border-rose-300 bg-rose-50 p-2 text-[10px] font-black uppercase text-rose-900">{blockedMessage}</div>}

        {result && (
          <div className="border border-[#b1b5c2]">
            <div className="bg-slate-50 border-b border-[#b1b5c2] p-2 text-[10px] font-black uppercase text-[#1e222b]">
              {result.operation} | {result.status} | {result.message}
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-bold uppercase">
              <span>Doc ID: {result.docId || '-'}</span>
              <span>Started: {result.startedAt}</span>
              <span>Completed: {result.completedAt}</span>
              {result.error && <span className="md:col-span-3 text-rose-800">Error: {result.error}</span>}
            </div>
            {result.rows && result.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-[#1e222b] text-white uppercase">
                    <tr>{['ID', 'Title', 'Message', 'No.', 'Status', 'Deleted', 'Updated'].map((header) => <th key={header} className="p-2">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#d6d9e0]">
                    {result.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="p-2 font-black">{row.id}</td>
                        <td className="p-2">{row.title}</td>
                        <td className="p-2">{row.message}</td>
                        <td className="p-2">{row.testNumber}</td>
                        <td className="p-2">{row.status}</td>
                        <td className="p-2">{row.deleted ? 'Yes' : 'No'}</td>
                        <td className="p-2">{row.updatedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#b1b5c2] bg-slate-50 p-3 min-h-16"><span className="block text-[8.5px] text-slate-500 uppercase font-black">{label}</span><strong className="block mt-1 text-[11px] text-[#1e222b] uppercase break-words">{value}</strong></div>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<input className="w-full p-2 border border-[#b1b5c2] text-xs" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" className={`px-3 py-2 border text-[9px] font-black uppercase ${primary ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b1b5c2] text-[#1e222b] hover:bg-orange-50'}`} onClick={onClick}>{label}</button>;
}

