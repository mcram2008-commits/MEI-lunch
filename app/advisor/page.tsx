"use client";

import { useState, useEffect } from "react";
import { GlobalStore, MOCK_STUDENTS, Pass, Advisor, Student } from "@/lib/store";
import {
    Menu, X, ShieldAlert, UserCheck, Inbox, LogOut,
    User, CheckCircle, Clock, Calendar, ArrowLeft, Trash2, History, AlertTriangle
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdvisorPortal() {
    const [advisor, setAdvisor] = useState<Advisor | null>(null);
    const [requests, setRequests] = useState<Pass[]>([]);
    const [historyRequests, setHistoryRequests] = useState<Pass[]>([]);
    const [notEntryPasses, setNotEntryPasses] = useState<Pass[]>([]);
    const [duplicatePasses, setDuplicatePasses] = useState<Pass[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "profile" | "history" | "security">("pending");
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
            setNotEntryPasses(notEntry.filter(p => {
                // Return only those who are actually overdue (passed their endTime by some time)
                if (!p.endTime) return false;
                const [h, m] = p.endTime.split(":").map(Number);
                const end = new Date();
                end.setHours(h, m, 0);
                const diff = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
                return diff > 0;
            }));

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
                GlobalStore.sendCustomEmail(student.id, `${student.username}@college.edu`, message);
                GlobalStore.updatePass(pass.id, { parentNotified: true });
                alert("Parent Notified via Email");
            } else {
                GlobalStore.updatePass(pass.id, { status: "used", scannedInAt: new Date().toISOString() });
                alert("Student marked as Returned");
            }
        }
    };

    const handleLogout = () => { sessionStorage.clear(); router.push("/login"); };

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
                        {activeTab === 'pending' ? 'Official Leave' : 
                         activeTab === 'history' ? 'Pass History' : 
                         activeTab === 'security' ? 'Security Alerts' : 'My Profile'}
                    </h1>
                </div>
            </header>

            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-[60] transition-transform duration-300 transform ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="p-8 pt-24 space-y-2">
                    {[
                        { id: "pending", label: "Official Leave", icon: <Inbox size={20} /> },
                        { id: "security", label: "Security Alerts", icon: <ShieldAlert size={20} /> },
                        { id: "history", label: "Pass History", icon: <History size={20} /> },
                        { id: "profile", label: "My Profile", icon: <User size={20} /> },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id as any); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${activeTab === item.id ? "bg-[#1e3a8a] text-white shadow-lg" : "text-gray-500 hover:bg-gray-50"}`}
                        >
                            {item.icon}
                            <span className="font-bold uppercase tracking-widest text-[10px]">{item.label}</span>
                        </button>
                    ))}
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-500 hover:bg-red-50 mt-10">
                        <LogOut size={20} />
                        <span className="font-bold uppercase tracking-widest text-[10px]">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="pt-24 pb-12 px-6 max-w-5xl mx-auto">
                {activeTab === "pending" && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tighter">Pending Approvals</h2>
                            <span className="bg-blue-100 text-blue-700 font-bold px-4 py-1 rounded-full text-xs uppercase">{requests.length} Requests</span>
                        </div>

                        {requests.length === 0 ? (
                            <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-gray-100">
                                <UserCheck className="mx-auto text-gray-200 mb-6" size={64} />
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">All clear! No pending leave requests.</p>
                            </div>
                        ) : (
                            <div className="grid gap-6">
                                {requests.map((request) => {
                                    const student = MOCK_STUDENTS().find(s => s.id === request.studentId);
                                    return (
                                        <div key={request.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
                                            <div className="flex flex-col md:flex-row justify-between gap-8">
                                                <div className="flex items-start gap-6">
                                                    <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center font-black text-[#1e3a8a] text-2xl border-4 border-blue-100/50">
                                                        {student?.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-xl text-gray-900 mb-1">{student?.name}</h3>
                                                        <div className="flex flex-wrap gap-2 mb-4">
                                                            <span className="bg-gray-100 text-gray-500 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase">{student?.rollNo}</span>
                                                            <span className="bg-blue-50 text-blue-600 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase">{request.type}</span>
                                                        </div>
                                                        <div className="space-y-2 text-sm text-gray-500 font-medium bg-gray-50 p-6 rounded-3xl border border-gray-100 italic">
                                                            <div className="flex items-center gap-3"><Calendar size={16} /> {request.date}</div>
                                                            <div className="flex items-center gap-3"><Clock size={16} /> {request.startTime} - {request.endTime}</div>
                                                            <p className="mt-4 pt-4 border-t border-gray-100 text-[#1e3a8a] leading-relaxed">" {request.reason} "</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex md:flex-col gap-3">
                                                    <button onClick={() => handleAction(request.id, "approved")} className="flex-1 px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-100">Approve</button>
                                                    <button onClick={() => handleAction(request.id, "rejected")} className="flex-1 px-8 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all">Reject</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "security" && (
                    <div className="space-y-12">
                        {/* Not Returned List */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 text-orange-600">
                                <AlertTriangle size={32} />
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Overdue: Not Entered in Gate</h2>
                            </div>
                            
                            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-orange-50 text-orange-700 text-[10px] uppercase font-black tracking-widest">
                                        <tr>
                                            <th className="px-8 py-5 italic">Student Identity</th>
                                            <th className="px-8 py-5 italic">Lunch Slot</th>
                                            <th className="px-8 py-5 italic text-right">Escalation</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {notEntryPasses.length === 0 ? (
                                            <tr><td colSpan={3} className="px-8 py-16 text-center text-gray-400 font-bold uppercase text-[10px] italic">No security alerts found. All students accounted for.</td></tr>
                                        ) : (
                                            notEntryPasses.map(p => {
                                                const student = MOCK_STUDENTS().find(s => s.id === p.studentId);
                                                return (
                                                    <tr key={p.id} className="hover:bg-gray-50 transition-all font-bold">
                                                        <td className="px-8 py-6">
                                                            <p className="text-[#1e3a8a] uppercase text-xs font-black">{student?.name}</p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{student?.rollNo}</p>
                                                        </td>
                                                        <td className="px-8 py-6 text-xs text-gray-600 font-mono">
                                                            OUT: {p.scannedOutAt ? new Date(p.scannedOutAt).toLocaleTimeString() : 'N/A'}<br/>
                                                            DEADLINE: {p.endTime}
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <button 
                                                                onClick={() => handleParentEscalation(p, "not")}
                                                                className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${p.parentNotified ? 'bg-gray-100 text-gray-400' : 'bg-red-600 text-white shadow-lg shadow-red-100 hover:scale-105'}`}
                                                            >
                                                                {p.parentNotified ? "Notified" : "Notify Parent (Email)"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Duplicate Entries */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 text-purple-600">
                                <ShieldAlert size={32} />
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Gate Check: Duplicate Entry Alert</h2>
                            </div>
                            
                            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-purple-50 text-purple-700 text-[10px] uppercase font-black tracking-widest">
                                        <tr>
                                            <th className="px-8 py-5 italic">Student Identity</th>
                                            <th className="px-8 py-5 italic">Duplicate Passes</th>
                                            <th className="px-8 py-5 italic text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {duplicatePasses.length === 0 ? (
                                            <tr><td colSpan={3} className="px-8 py-16 text-center text-gray-400 font-bold uppercase text-[10px] italic">No duplicate entry requests detected.</td></tr>
                                        ) : (
                                            duplicatePasses.map(p => {
                                                const student = MOCK_STUDENTS().find(s => s.id === p.studentId);
                                                return (
                                                    <tr key={p.id} className="hover:bg-gray-50 transition-all font-bold">
                                                        <td className="px-8 py-6">
                                                            <p className="text-[#1e3a8a] uppercase text-xs font-black">{student?.name}</p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{student?.rollNo}</p>
                                                        </td>
                                                        <td className="px-8 py-6 text-xs text-gray-600">
                                                            Date: {p.date}<br/>
                                                            Slot: {p.startTime}-{p.endTime}
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-[9px] font-black uppercase">{p.status}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tighter">Pass History</h2>
                            <span className="bg-gray-100 text-gray-500 font-bold px-4 py-1 rounded-full text-xs uppercase">{historyRequests.length} Total</span>
                        </div>
                        
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr className="text-[10px] uppercase font-black tracking-widest text-gray-400 italic">
                                        <th className="px-8 py-6">Student</th>
                                        <th className="px-8 py-6">Type / Date</th>
                                        <th className="px-8 py-6">Timeline</th>
                                        <th className="px-8 py-6 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {historyRequests.map((p) => {
                                        const student = MOCK_STUDENTS().find(s => s.id === p.studentId);
                                        return (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-all font-bold">
                                                <td className="px-8 py-6">
                                                    <p className="text-[#1e3a8a] text-xs uppercase font-black">{student?.name}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{student?.rollNo}</p>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <p className="text-xs text-gray-900 uppercase">{p.type}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5 italic">{p.date}</p>
                                                </td>
                                                <td className="px-8 py-6 text-xs text-gray-500 font-mono">
                                                    {p.startTime} - {p.endTime}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                        p.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100' :
                                                        p.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        'bg-gray-50 text-gray-500 border-gray-200'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "profile" && (
                    <div className="bg-white rounded-[3rem] p-12 md:p-16 shadow-xl border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 -z-10" />
                        <div className="flex flex-col md:flex-row items-center gap-12">
                            <div className="w-40 h-40 rounded-[2.5rem] bg-[#1e3a8a] flex items-center justify-center font-black text-white text-6xl shadow-2xl shadow-blue-200 border-8 border-white">
                                {advisor.name.charAt(0)}
                            </div>
                            <div className="text-center md:text-left">
                                <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-4">{advisor.name}</h2>
                                <div className="grid gap-3">
                                    <div className="flex items-center gap-4 text-gray-500 font-bold uppercase tracking-widest text-xs ring-1 ring-gray-100 bg-gray-50 px-6 py-2 rounded-full">
                                        <ShieldAlert size={16} className="text-[#1e3a8a]" />
                                        Department: {advisor.department}
                                    </div>
                                    <div className="flex items-center gap-4 text-gray-500 font-bold uppercase tracking-widest text-xs ring-1 ring-gray-100 bg-gray-50 px-6 py-2 rounded-full">
                                        <Clock size={16} className="text-[#1e3a8a]" />
                                        Class: {advisor.assignedClass}
                                    </div>
                                    <div className="flex items-center gap-4 text-gray-500 font-bold uppercase tracking-widest text-xs ring-1 ring-gray-100 bg-gray-50 px-6 py-2 rounded-full">
                                        <Clock size={16} className="text-[#1e3a8a]" />
                                        Contact: {advisor.phone}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
