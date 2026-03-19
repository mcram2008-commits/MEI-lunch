"use client";

import { useState, useEffect } from "react";
import { GlobalStore, MOCK_STUDENTS, Pass, Advisor, Student } from "@/lib/store";
import {
    Menu, X, ShieldAlert, UserCheck, Inbox, LogOut,
    User, CheckCircle, Clock, Calendar, ArrowLeft, Trash2, History
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdvisorPortal() {
    const [advisor, setAdvisor] = useState<Advisor | null>(null);
    const [requests, setRequests] = useState<Pass[]>([]);
    const [historyRequests, setHistoryRequests] = useState<Pass[]>([]);
    const [latePasses, setLatePasses] = useState<Pass[]>([]);
    const [notEntryPasses, setNotEntryPasses] = useState<Pass[]>([]);
    const [duplicatePasses, setDuplicatePasses] = useState<Pass[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "profile" | "history" | "late">("pending");
    const router = useRouter();

    useEffect(() => {
        const savedUser = sessionStorage.getItem("user");
        if (!savedUser) { router.push("/login"); return; }
        const user = JSON.parse(savedUser) as Advisor;
        if (user.role !== "advisor") { router.push("/login"); return; }
        setAdvisor(user);

        const update = () => {
            const allStudents = MOCK_STUDENTS();
            const allPasses = GlobalStore.getPasses();
            const now = new Date();

            const pending = allPasses.filter(p => {
                const student = allStudents.find(s => s.id === p.studentId);
                if (!student) return false;
                const studentClass = `${student.department}-${student.year}-${student.section}`.toUpperCase();
                return p.type === "leave" && p.status === "pending" && studentClass === user.assignedClass.toUpperCase();
            });
            setRequests(pending);

            const history = allPasses.filter(p => {
                const student = allStudents.find(s => s.id === p.studentId);
                if (!student) return false;
                const studentClass = `${student.department}-${student.year}-${student.section}`.toUpperCase();
                return studentClass === user.assignedClass.toUpperCase() && (p.status === "approved" || p.status === "rejected" || p.status === "used" || p.status === "expired");
            }).sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
            setHistoryRequests(history);

            // Not Entry List: Scanned Out but NOT Scanned In
            const notEntry = allPasses.filter(p => {
                const student = allStudents.find(s => s.id === p.studentId);
                if (!student) return false;
                const studentClass = `${student.department}-${student.year}-${student.section}`.toUpperCase();
                if (studentClass !== user.assignedClass.toUpperCase()) return false;
                
                return p.scannedOutAt && !p.scannedInAt;
            });
            setNotEntryPasses(notEntry);

            // Duplicate Entry: Students with multiple passes on the same day
            const studentsWithPasses = allPasses.filter(p => {
                const student = allStudents.find(s => s.id === p.studentId);
                if (!student) return false;
                const studentClass = `${student.department}-${student.year}-${student.section}`.toUpperCase();
                return studentClass === user.assignedClass.toUpperCase();
            });

            const dateStudentMap: { [key: string]: Pass[] } = {};
            studentsWithPasses.forEach(p => {
                const key = `${p.date}_${p.studentId}`;
                if (!dateStudentMap[key]) dateStudentMap[key] = [];
                dateStudentMap[key].push(p);
            });

            const duplicates = Object.values(dateStudentMap).filter(group => group.length > 1).flat();
            setDuplicatePasses(duplicates);

            // Keep the old latePasses for compatibility with any existing UI refs, but we'll show new lists
            setLatePasses(notEntry); 
        };
        update();
        return GlobalStore.subscribe(update);
    }, [router]);

    const handleAction = (id: string, action: "approved" | "rejected") => {
        GlobalStore.updatePass(id, {
            status: action,
            approvedAt: action === "approved" ? new Date().toISOString() : undefined,
        });
    };

    const handleParentEscalation = (pass: Pass, response: "enter" | "not") => {
        const student = MOCK_STUDENTS().find(s => s.id === pass.studentId);
        if (student && advisor) {
            if (response === "not") {
                const message = `Security Alert: Student ${student.name} (${student.rollNo}) has NOT returned by the lunch deadline (${pass.endTime}). Please contact immediately.`;
                GlobalStore.sendCustomSMS(student.id, student.parentPhone, message);
                GlobalStore.updatePass(pass.id, { parentNotified: true });

                // Manual Email Trigger
                fetch("/api/send-advisor-mail", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: 'overdue',
                        studentName: student.name,
                        studentRoll: student.rollNo,
                        studentClass: `${student.department} ${student.year}-${student.section}`,
                        advisorEmail: advisor.username.includes('@') ? advisor.username : "mcram2008@gmail.com",
                        passDetails: {
                            id: pass.id,
                            type: pass.type,
                            endTime: pass.endTime,
                            scannedOutAt: pass.scannedOutAt,
                        }
                    }),
                }).catch(err => console.error("Manual advisor email failed:", err));
            } else {
                GlobalStore.updatePass(pass.id, { status: "used", scannedInAt: new Date().toISOString() });
                alert("Student marked as Returned");
            }
        }
    };

    const handleLogout = () => { sessionStorage.removeItem("user"); router.push("/login"); };

    if (!advisor) return null;

    return (
        <div className="min-h-screen bg-[#f3f4f9]">
            {/* Header Banner */}
            <header className="fixed top-0 bg-gradient-to-r from-[#1e3a8a] to-[#4338ca] text-white w-full h-16 flex items-center px-6 z-50">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -ml-2">
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <div className="ml-6 flex items-center gap-3">
                    <h1 className="font-bold text-lg tracking-tight capitalize">
                        {activeTab === 'pending' ? 'Advisor Approval' : 
                         activeTab === 'history' ? 'Pass History' : 
                         activeTab === 'late' ? 'Overdue List' : 'Profile'}
                    </h1>
                    {(notEntryPasses.length + duplicatePasses.length) > 0 && <span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">{notEntryPasses.length + duplicatePasses.length}</span>}
                </div>
            </header>

            {/* Sidebar Drawer */}
            <div
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={() => setIsMenuOpen(false)}
            />
            <aside className={`fixed top-0 left-0 h-full w-[80%] bg-[#333333] z-50 shadow-2xl transition-transform duration-300 transform ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex flex-col h-full text-white">
                    <div className="bg-[#1e3a8a] p-10 text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 font-black text-[#1e3a8a] text-2xl overflow-hidden border-2 border-white/20">
                            {advisor.profileImg ? (
                                <img src={advisor.profileImg} className="w-full h-full object-cover rounded-full" alt="Profile" />
                            ) : (
                                <span>{advisor.name.charAt(0)}</span>
                            )}
                        </div>
                        <p className="font-black uppercase tracking-widest">{advisor.name}</p>
                        <p className="text-[10px] opacity-60 mt-1 font-bold">{advisor.assignedClass}</p>
                    </div>
                    <nav className="flex-1 p-4 space-y-2 mt-4">
                        <button
                            onClick={() => { setActiveTab("pending"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-colors ${activeTab === 'pending' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <Inbox size={20} /> Leave Inbox
                        </button>
                        <button
                            onClick={() => { setActiveTab("late"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-colors ${activeTab === 'late' ? 'bg-red-500/20 text-red-200' : 'hover:bg-white/5 opacity-70'}`}
                        >
                            <ShieldAlert size={20} /> Overdue List {(notEntryPasses.length + duplicatePasses.length) > 0 && <span className="ml-auto bg-red-600 px-2 py-0.5 rounded text-[8px]">{notEntryPasses.length + duplicatePasses.length}</span>}
                        </button>
                        <button
                            onClick={() => { setActiveTab("history"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-colors ${activeTab === 'history' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <History size={20} /> Pass History
                        </button>
                        <button
                            onClick={() => { setActiveTab("profile"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-colors ${activeTab === 'profile' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <User size={20} /> My Profile
                        </button>
                        <hr className="border-white/10 my-6" />
                        <button onClick={handleLogout} className="w-full flex items-center gap-4 p-4 rounded-xl font-bold text-red-100 hover:bg-red-500/10">
                            <LogOut size={20} /> Logout
                        </button>
                    </nav>
                </div>
            </aside>

            <main className="pt-20 px-6 pb-20">
                {activeTab === "pending" && (
                    <div className="animate-in fade-in space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="text-[#1e3a8a]" size={20} />
                            <h2 className="font-black text-gray-500 uppercase tracking-widest text-xs">Waiting Approval</h2>
                        </div>

                        {requests.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 italic font-bold text-gray-300">No pending leave requests</div>
                        ) : (
                            requests.map(pass => {
                                const student = MOCK_STUDENTS().find(s => s.id === pass.studentId);
                                return (
                                    <div key={pass.id} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4 animate-in slide-in-from-bottom-4">
                                        <div className="flex items-center gap-4 border-b pb-4">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">{student?.name.charAt(0)}</div>
                                            <div><p className="font-black text-[#1e3a8a]">{student?.name}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{student?.rollNo}</p></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-500 uppercase">
                                            <div className="flex items-center gap-2 font-bold"><Calendar size={14} /> {pass.date}</div>
                                            <div className="flex items-center gap-2 font-bold"><Clock size={14} /> {pass.startTime}-{pass.endTime}</div>
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={() => handleAction(pass.id, "rejected")} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest">Reject</button>
                                            <button onClick={() => handleAction(pass.id, "approved")} className="flex-1 py-3 bg-[#1e3a8a] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100">Approve</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="animate-in fade-in space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="text-[#1e3a8a]" size={20} />
                            <h2 className="font-black text-gray-500 uppercase tracking-widest text-xs">Full Pass History</h2>
                        </div>

                        {historyRequests.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 italic font-bold text-gray-300">No pass history available</div>
                        ) : (
                            historyRequests.map(pass => {
                                const student = MOCK_STUDENTS().find(s => s.id === pass.studentId);
                                return (
                                    <div key={pass.id} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4 animate-in slide-in-from-bottom-4 relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-widest ${pass.status === 'approved' ? 'bg-blue-100 text-blue-700' : pass.status === 'used' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {pass.status}
                                        </div>
                                        <div className="flex items-center gap-4 border-b pb-4">
                                            <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-lg flex items-center justify-center font-black">{student?.name.charAt(0)}</div>
                                            <div><p className="font-black text-[#1e3a8a] text-sm">{student?.name}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{student?.rollNo}</p></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-gray-500 uppercase">
                                            <div className="flex items-center gap-2"><Calendar size={12} /> {pass.date}</div>
                                            <div className="flex items-center gap-2"><Clock size={12} /> {pass.startTime}-{pass.endTime}</div>
                                        </div>
                                        {pass.reason && (
                                            <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-blue-200">
                                                <p className="text-[9px] text-gray-400 italic">" {pass.reason} "</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === "late" && (
                    <div className="animate-in fade-in space-y-8 py-8">
                        {notEntryPasses.length === 0 && duplicatePasses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100 italic font-bold text-gray-300 uppercase text-[10px]">
                                <Clock size={48} className="mb-4 opacity-20" />
                                <p>No Audits or Alerts Found</p>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                {notEntryPasses.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldAlert className="text-red-600" size={18} />
                                            <h3 className="text-xs font-black text-red-600 uppercase tracking-[0.2em]">Overdue: Not Entered in Gate</h3>
                                        </div>
                                        {notEntryPasses.map(pass => {
                                            const student = MOCK_STUDENTS().find(s => s.id === pass.studentId);
                                            return (
                                                <div key={pass.id} className="bg-white rounded-3xl shadow-xl border-l-[12px] border-red-500 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:scale-[1.01]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center font-black">{student?.name.charAt(0)}</div>
                                                        <div>
                                                            <p className="font-black text-gray-900 text-sm uppercase tracking-tighter">{student?.name}</p>
                                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Exited at {new Date(pass.scannedOutAt!).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 w-full md:w-auto">
                                                        <button 
                                                            onClick={() => handleParentEscalation(pass, "enter")} 
                                                            className="flex-1 md:flex-none px-6 py-3 bg-green-50 text-green-700 rounded-xl font-black text-[9px] uppercase border border-green-100"
                                                        >
                                                            Mark Entry
                                                        </button>
                                                        <button 
                                                            onClick={() => handleParentEscalation(pass, "not")} 
                                                            className="flex-1 md:flex-none px-6 py-3 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-red-100"
                                                        >
                                                            Not Returned
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {duplicatePasses.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <History className="text-orange-500" size={18} />
                                            <h3 className="text-xs font-black text-orange-600 uppercase tracking-[0.2em]">Gate Check: Duplicate Entry Alert</h3>
                                        </div>
                                        {Array.from(new Set(duplicatePasses.map(p => p.studentId))).map(sid => {
                                            const student = MOCK_STUDENTS().find(s => s.id === sid);
                                            const studentDuplicates = duplicatePasses.filter(p => p.studentId === sid);
                                            return (
                                                <div key={sid} className="bg-white rounded-3xl shadow-xl border-l-[12px] border-orange-400 p-6 flex flex-col gap-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center font-black">{student?.name.charAt(0)}</div>
                                                        <div>
                                                            <p className="font-black text-gray-900 text-sm uppercase tracking-tighter">{student?.name}</p>
                                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Multiple passes on {studentDuplicates[0]?.date}</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-orange-50/40 rounded-2xl p-4 space-y-3 border border-orange-100/50">
                                                        {studentDuplicates.map(p => (
                                                            <div key={p.id} className="flex justify-between items-center text-[9px] font-black text-orange-900 uppercase">
                                                                <span className="bg-white px-2 py-1 rounded border border-orange-100">{p.type} Pass ({p.startTime}-{p.endTime})</span>
                                                                <span className="opacity-60">{p.status}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "profile" && (
                    <div className="animate-in fade-in space-y-8 py-8">
                        <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border">
                            <div className="bg-[#1e3a8a] h-32 relative flex justify-center items-end pb-8">
                                <div className="absolute -bottom-12 w-48 h-48 bg-white rounded-[2.5rem] border-4 border-white shadow-xl overflow-hidden flex items-center justify-center text-[#1e3a8a] font-black text-6xl">
                                    {(advisor as Advisor).profileImg ? (
                                        <img src={(advisor as Advisor).profileImg} className="w-full h-full object-cover rounded-full" alt="Profile" />
                                    ) : (
                                        <span>{(advisor as Advisor).name.charAt(0)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="p-8 pt-16 space-y-8">
                                <div className="text-center border-b pb-8"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Advisor Name</p><p className="text-xl font-black text-[#1e3a8a]">{(advisor as Advisor).name}</p></div>
                                <div className="text-center border-b pb-8"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Assigned Jurisdiction</p><p className="text-xl font-black text-green-600 uppercase italic">{(advisor as Advisor).assignedClass} Class</p></div>
                                <div className="text-center border-b pb-8"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Primary Mobile</p><p className="text-xl font-black text-blue-600 italic tracking-widest">{(advisor as Advisor).phone}</p></div>
                                <div className="text-center"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Primary Dept</p><p className="text-xl font-black text-gray-900">{(advisor as Advisor).department}</p></div>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl font-black uppercase tracking-widest">System Logout</button>
                    </div>
                )}
            </main>
        </div>
    );
}
