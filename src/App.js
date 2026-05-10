import React, { useState, useEffect } from "react";
import {
  collection, doc, setDoc, getDoc, getDocs,
  onSnapshot, updateDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import { db } from "./firebase";
import * as XLSX from "xlsx";

const DEFAULT_ATTENDANTS = ["Gate A", "Gate B", "Gate C"];
const STUDENTS_DOC = "config/students";
const ATTENDANTS_DOC = "config/attendants";

const formatDateDisplay = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dateObj = new Date(Number(y), Number(m) - 1, Number(day));
  return `${days[dateObj.getDay()]}, ${day} ${months[Number(m)-1]} ${y}`;
};

const todayStr = () => new Date().toISOString().split("T")[0];

export default function App() {
  const [view, setView] = useState("home");
  const [students, setStudents] = useState([]);
  const [attendantNames, setAttendantNames] = useState(DEFAULT_ATTENDANTS);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState([]);
  const [allDates, setAllDates] = useState([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [selectedGate, setSelectedGate] = useState(null);
  const [recordDate, setRecordDate] = useState("");
  const [recordData, setRecordData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");

  // Load students and attendant names on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const sSnap = await getDoc(doc(db, "config", "students"));
        if (sSnap.exists()) setStudents(sSnap.data().list || []);
        else {
          await setDoc(doc(db, "config", "students"), { list: [] });
        }
        const aSnap = await getDoc(doc(db, "config", "attendants"));
        if (aSnap.exists()) setAttendantNames(aSnap.data().names || DEFAULT_ATTENDANTS);
        else {
          await setDoc(doc(db, "config", "attendants"), { names: DEFAULT_ATTENDANTS });
        }
      } catch (e) { showToast("Error loading data", "error"); }
      setLoading(false);
    };
    loadConfig();
    // Load all attendance dates
    loadDates();
  }, []);

  const loadDates = async () => {
    try {
      const snap = await getDocs(collection(db, "attendance"));
      const dates = snap.docs.map(d => d.id).sort((a, b) => b.localeCompare(a));
      setAllDates(dates);
    } catch {}
  };

  // Real-time listener for active session
  useEffect(() => {
    if (!activeSession) return;
    const unsub = onSnapshot(doc(db, "attendance", activeSession.date), (snap) => {
      if (snap.exists()) setSessionRecords(snap.data().records || []);
      else setSessionRecords([]);
    });
    return () => unsub();
  }, [activeSession]);

  // Load records for selected date in Records tab
  useEffect(() => {
    if (!recordDate) return;
    const unsub = onSnapshot(doc(db, "attendance", recordDate), (snap) => {
      if (snap.exists()) setRecordData(snap.data().records || []);
      else setRecordData([]);
    });
    return () => unsub();
  }, [recordDate]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const saveStudents = async (list) => {
    setStudents(list);
    await setDoc(doc(db, "config", "students"), { list });
  };

  const saveAttendants = async (names) => {
    setAttendantNames(names);
    await setDoc(doc(db, "config", "attendants"), { names });
  };

  const initiateSession = async () => {
    if (!newDate) { showToast("Please select a date", "warn"); return; }
    if (!selectedGate) { showToast("Please select your gate", "warn"); return; }
    // Create date doc if not exists
    const ref = doc(db, "attendance", newDate);
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { records: [], date: newDate });
    setActiveSession({ date: newDate, gate: selectedGate });
    setSearch("");
    setView("checkin");
    loadDates();
  };

  const checkIn = async (name) => {
    const ref = doc(db, "attendance", activeSession.date);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().records || []) : [];
    if (existing.find(e => e.name === name)) {
      showToast(`${name.split(" ")[0]} already checked in!`, "warn");
      return;
    }
    const entry = {
      name,
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      gate: activeSession.gate
    };
    await updateDoc(ref, { records: arrayUnion(entry) });
    showToast(`✓ ${name.split(" ")[0]} checked in`);
  };

  const undoCheckIn = async (name) => {
    const ref = doc(db, "attendance", activeSession.date);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().records || []) : [];
    const entry = existing.find(e => e.name === name);
    if (entry) {
      await updateDoc(ref, { records: arrayRemove(entry) });
      showToast(`Removed ${name.split(" ")[0]}`, "warn");
    }
  };

  const downloadExcel = (date, records) => {
    const present = records.map(r => ({ Name: r.name, Time: r.time, Gate: r.gate, Status: "Present" }));
    const absent = students
      .filter(s => !records.find(r => r.name === s))
      .map(s => ({ Name: s, Time: "-", Gate: "-", Status: "Absent" }));
    const data = [...present, ...absent];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `NIFES_FUHSo_Attendance_${date}.xlsx`);
  };

  const checkedNames = new Set(sessionRecords.map(e => e.name));
  const filtered = students.filter(s => s.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8", fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⛪</div>
        <div style={{ fontWeight: 700, color: "#1a1a2e" }}>Loading NIFES FUHSO...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", fontFamily: "'Outfit', sans-serif", color: "#1a1a2e", maxWidth: 480, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "#2d6a4f" : toast.type === "error" ? "#c1440e" : "#b45309",
          color: "#fff", padding: "10px 22px", borderRadius: 30, zIndex: 999,
          fontWeight: 600, fontSize: 13, boxShadow: "0 4px 24px rgba(0,0,0,0.2)", whiteSpace: "nowrap"
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)", padding: "20px 20px 16px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#e2b96f" }}>NIFES FUHSO</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Check-In System</div>
          </div>
          {activeSession && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#e2b96f", fontWeight: 700 }}>{activeSession.gate}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{formatDateDisplay(activeSession.date)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", background: "#1a1a2e", padding: "0 8px" }}>
        {[["home","🏠","Home"],["checkin","✅","Check In"],["records","📋","Records"],["manage","⚙️","Manage"]].map(([v, icon, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: "10px 0", border: "none", background: "transparent", cursor: "pointer",
            color: view === v ? "#e2b96f" : "rgba(255,255,255,0.4)",
            fontWeight: view === v ? 700 : 500, fontSize: 11,
            borderBottom: `2px solid ${view === v ? "#e2b96f" : "transparent"}`,
            fontFamily: "'Outfit', sans-serif"
          }}>{icon}<br />{label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* HOME */}
        {view === "home" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Start Attendance</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Set the date and select your gate.</div>

              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Date</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{ display: "block", width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e0d9cc", background: "#faf8f4", fontSize: 14, marginTop: 6, marginBottom: 16, boxSizing: "border-box", outline: "none", fontFamily: "'Outfit', sans-serif" }}
              />

              <label style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Your Gate</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 20 }}>
                {attendantNames.map(a => (
                  <button key={a} onClick={() => setSelectedGate(a)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 10, border: "1.5px solid",
                    borderColor: selectedGate === a ? "#0f3460" : "#e0d9cc",
                    background: selectedGate === a ? "#0f3460" : "#faf8f4",
                    color: selectedGate === a ? "#e2b96f" : "#888",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', sans-serif"
                  }}>{a}</button>
                ))}
              </div>

              <button onClick={initiateSession} style={{
                width: "100%", padding: 13, borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
                color: "#e2b96f", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Outfit', sans-serif"
              }}>Begin Check-In →</button>
            </div>

            {allDates.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Recent Sessions</div>
                {allDates.slice(0, 5).map(d => (
                  <div key={d} onClick={() => { setRecordDate(d); setView("records"); }} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#fff", borderRadius: 12, padding: "12px 16px", marginBottom: 8,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)", cursor: "pointer"
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{formatDateDisplay(d)}</div>
                    </div>
                    <div style={{ fontSize: 20, color: "#ccc" }}>›</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHECK IN */}
        {view === "checkin" && !activeSession && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No Active Session</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Go to Home to start attendance.</div>
            <button onClick={() => setView("home")} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#0f3460", color: "#e2b96f", fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Go to Home</button>
          </div>
        )}

        {view === "checkin" && activeSession && (
          <div>
            <div style={{ background: "#0f3460", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Session · {activeSession.gate}</div>
                <div style={{ fontSize: 13, color: "#e2b96f", fontWeight: 700 }}>{formatDateDisplay(activeSession.date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, color: "#fff", fontWeight: 800 }}>{sessionRecords.length}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>/{students.length}</span></div>
              </div>
            </div>

            <input placeholder="🔍 Search member..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e0d9cc", background: "#fff", fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none", fontFamily: "'Outfit', sans-serif" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(name => {
                const checked = checkedNames.has(name);
                const record = sessionRecords.find(e => e.name === name);
                return (
                  <div key={name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 12,
                    background: checked ? "#f0faf4" : "#fff",
                    border: `1.5px solid ${checked ? "#2d6a4f" : "#e8e2d9"}`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: checked ? "#2d6a4f" : "#1a1a2e" }}>{name}</div>
                      {checked && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>✓ {record.time} · {record.gate}</div>}
                    </div>
                    {checked ? (
                      <button onClick={() => undoCheckIn(name)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ccc", background: "transparent", color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Undo</button>
                    ) : (
                      <button onClick={() => checkIn(name)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0f3460", color: "#e2b96f", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Check In</button>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>No members found</div>}
            </div>

            <button onClick={() => { setActiveSession(null); setView("home"); }} style={{
              width: "100%", marginTop: 20, padding: 12, borderRadius: 12, border: "1.5px solid #e0d9cc",
              background: "#fff", color: "#c1440e", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Outfit', sans-serif"
            }}>End Session</button>
          </div>
        )}

        {/* RECORDS */}
        {view === "records" && (
          <div>
            <select value={recordDate} onChange={e => setRecordDate(e.target.value)} style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e0d9cc",
              background: "#fff", fontSize: 14, marginBottom: 16, outline: "none", fontFamily: "'Outfit', sans-serif"
            }}>
              <option value="">— Select a date —</option>
              {allDates.map(d => <option key={d} value={d}>{formatDateDisplay(d)}</option>)}
            </select>

            {!recordDate && <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>Select a date to view records</div>}

            {recordDate && (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: "#f0faf4", borderRadius: 12, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#2d6a4f" }}>{recordData.length}</div>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>PRESENT</div>
                  </div>
                  <div style={{ flex: 1, background: "#fff5f0", borderRadius: 12, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#c1440e" }}>{students.length - recordData.length}</div>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>ABSENT</div>
                  </div>
                </div>

                {/* Per gate breakdown */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {attendantNames.map(g => (
                    <div key={g} style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 8, textAlign: "center", border: "1px solid #e8e2d9" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3460" }}>{recordData.filter(e => e.gate === g).length}</div>
                      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{g}</div>
                    </div>
                  ))}
                </div>

                {/* Download button */}
                <button onClick={() => downloadExcel(recordDate, recordData)} style={{
                  width: "100%", padding: 12, borderRadius: 12, border: "none",
                  background: "#2d6a4f", color: "#fff", fontWeight: 700, fontSize: 14,
                  cursor: "pointer", marginBottom: 16, fontFamily: "'Outfit', sans-serif"
                }}>⬇ Download Excel (.xlsx)</button>

                <div style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Present</div>
                {recordData.map(({ name, time, gate }) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "#f0faf4", border: "1px solid #b7e4c7", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{name}</span>
                    <span style={{ fontSize: 12, color: "#666" }}>{time} · {gate}</span>
                  </div>
                ))}

                {students.filter(s => !recordData.find(e => e.name === s)).length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#c1440e", textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 8px" }}>Absent</div>
                    {students.filter(s => !recordData.find(e => e.name === s)).map(name => (
                      <div key={name} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff5f0", border: "1px solid #f0c0b0", marginBottom: 6, fontSize: 14, color: "#999" }}>{name}</div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* MANAGE */}
        {view === "manage" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Gate / Line Names</div>
              {attendantNames.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {editIdx === i ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={() => {
                        const updated = [...attendantNames];
                        updated[i] = editVal.trim() || a;
                        saveAttendants(updated);
                        setEditIdx(null);
                      }}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #0f3460", fontSize: 13, outline: "none", fontFamily: "'Outfit', sans-serif" }}
                    />
                  ) : (
                    <div style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#faf8f4", border: "1px solid #e0d9cc", fontSize: 13 }}>{a}</div>
                  )}
                  <button onClick={() => { setEditIdx(i); setEditVal(a); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e0d9cc", background: "transparent", color: "#0f3460", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Rename</button>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Add Member</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder="Full name..." value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { saveStudents([...students, newName.trim()]); showToast(`Added ${newName.trim().split(" ")[0]}`); setNewName(""); } }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e0d9cc", fontSize: 14, outline: "none", fontFamily: "'Outfit', sans-serif" }}
                />
                <button onClick={() => { if (newName.trim()) { saveStudents([...students, newName.trim()]); showToast(`Added`); setNewName(""); } }}
                  style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#0f3460", color: "#e2b96f", fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Add</button>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Members ({students.length})</div>
              {students.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 20 }}>No members added yet</div>}
              {students.map((name, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "#faf8f4", border: "1px solid #e8e2d9", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
                  <button onClick={() => { saveStudents(students.filter((_, j) => j !== i)); showToast("Removed", "warn"); }}
                    style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid #f0c0b0", background: "transparent", color: "#c1440e", fontSize: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
