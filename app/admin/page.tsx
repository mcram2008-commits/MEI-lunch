"use client";

import { useState, useEffect } from "react";
import { GlobalStore, Pass, Student, Advisor, User } from "@/lib/store";
import {
    ShieldCheck, UserPlus, FileText, Trash2, LogOut, Plus, Search, Filter, ArrowLeft, ArrowRight,
    TrendingUp, Users, ShieldAlert, CheckCircle2, X, Menu
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SimpleAdmin() {
    const [passes, setPasses] = useState<Pass[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "advisors" | "logs">("dashboard");
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();

    const [newUser, setNewUser] = useState({
        username: "", password: "", name: "", role: "student" as any,
        rollNo: "", department: "", year: "", section: "",
        parentPhone: "", studentPhone: "", phone: "", assignedClass: "", profileImg: ""
    });

    useEffect(() => {
        const saved = sessionStorage.getItem("user");
        if (!saved || JSON.parse(saved).role !== "admin") { router.push("/login"); return; }
        const update = () => { setPasses([...GlobalStore.getPasses()]); setUsers([...GlobalStore.getUsers()]); };
        update();
        return GlobalStore.subscribe(update);
    }, [router]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewUser(prev => ({ ...prev, profileImg: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const role = activeTab === "students" ? "student" : "advisor";
        
        if (isEditingUser && editingUserId) {
            const updates: any = { username: newUser.username, password: newUser.password, name: newUser.name, profileImg: newUser.profileImg };
            if (role === 'student') {
                Object.assign(updates, { rollNo: newUser.rollNo, department: newUser.department, year: newUser.year, section: newUser.section, parentPhone: newUser.parentPhone, studentPhone: newUser.studentPhone });
            } else {
                Object.assign(updates, { department: newUser.department, assignedClass: newUser.assignedClass, phone: newUser.phone });
            }
            GlobalStore.updateUser(editingUserId, updates);
        } else {
            const id = Date.now().toString();
            const userBase = { id, username: newUser.username, password: newUser.password, name: newUser.name, role, profileImg: newUser.profileImg };
            if (role === "student") {
                GlobalStore.addUser({ ...userBase, rollNo: newUser.rollNo, department: newUser.department, year: newUser.year, section: newUser.section, parentPhone: newUser.parentPhone, studentPhone: newUser.studentPhone } as Student);
            } else {
                GlobalStore.addUser({ ...userBase, department: newUser.department, assignedClass: newUser.assignedClass, phone: newUser.phone } as Advisor);
            }
        }
        
        resetForm();
    };

    const resetForm = () => {
        setNewUser({ username: "", password: "", name: "", role: "student", rollNo: "", department: "", year: "", section: "", parentPhone: "", studentPhone: "", phone: "", assignedClass: "", profileImg: "" });
        setIsAddingUser(false);
        setIsEditingUser(false);
        setEditingUserId(null);
    };

    const startEdit = (user: any) => {
        setNewUser({
            username: user.username, password: user.password, name: user.name, role: user.role,
            rollNo: user.rollNo || "", department: user.department || "", year: user.year || "", section: user.section || "",
            parentPhone: user.parentPhone || "", studentPhone: user.studentPhone || "", phone: user.phone || "", assignedClass: user.assignedClass || "",
            profileImg: user.profileImg || ""
        });
        setEditingUserId(user.id);
        setIsEditingUser(true);
        setIsAddingUser(true);
    };

    const logout = () => { sessionStorage.clear(); router.push("/login"); };

    const students = users.filter(u => u.role === "student") as Student[];
    const advisors = users.filter(u => u.role === "advisor") as Advisor[];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Mobile Sidebar Toggle Overlay */}
            <div 
                className={`fixed inset-0 bg-black/60 z-[60] md:hidden transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`w-72 bg-[#1e3a8a] text-white flex flex-col h-screen p-8 fixed top-0 left-0 z-[70] transition-transform duration-300 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="mb-12 border-b border-white/10 pb-6 text-center relative">
                    <button onClick={() => setIsMenuOpen(false)} className="absolute top-0 right-0 md:hidden p-2 text-white/50"><X size={20} /></button>
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center font-black text-[#1e3a8a] text-3xl mx-auto mb-4 border-4 border-blue-400/20">M</div>
                    <h1 className="text-xl font-bold tracking-widest uppercase">Admin</h1>
                </div>

                <nav className="flex-1 space-y-2 uppercase text-[10px] tracking-widest font-black">
                    {[
                        { id: 'dashboard', label: 'Home', icon: <TrendingUp size={18} /> },
                        { id: 'students', label: 'Students', icon: <Users size={18} /> },
                        { id: 'advisors', label: 'Advisors', icon: <ShieldAlert size={18} /> },
                        { id: 'logs', label: 'Activity', icon: <FileText size={18} /> }
                    ].map(nav => (
                        <button 
                            key={nav.id}
                            onClick={() => { setActiveTab(nav.id as any); setIsMenuOpen(false); }} 
                            className={`w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all ${activeTab === nav.id ? 'bg-white/10 border-l-4 border-white' : 'hover:bg-white/5 opacity-60'}`}
                        >
                            {nav.icon} {nav.label}
                        </button>
                    ))}
                </nav>

                <button onClick={logout} className="p-4 bg-red-600/20 border border-red-500/30 rounded-xl flex items-center gap-4 uppercase font-bold text-xs mt-10 hover:bg-red-600 transition-all text-red-200">
                    <LogOut size={18} /> Logout
                </button>
            </aside>

            {/* Mobile Header (Fixed) */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-40 flex items-center px-6 justify-between">
                <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 text-[#1e3a8a]"><Menu size={24} /></button>
                <h1 className="font-black text-[#1e3a8a] text-sm tracking-widest uppercase">{activeTab}</h1>
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-[#1e3a8a] font-black underline">A</div>
            </header>

            {/* Main Area */}
            <main className="flex-1 md:ml-72 p-6 md:p-12 overflow-x-hidden pt-24 md:pt-12">
                <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-white p-8 md:p-10 rounded-[2rem] shadow-sm border">
                    <div>
                        <h2 className="text-3xl font-black text-[#1e3a8a] tracking-tighter uppercase">{activeTab} View</h2>
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1 italic">Authorized Personnel Access Only</p>
                    </div>
                    {(activeTab === 'students' || activeTab === 'advisors') && (
                        <button onClick={() => setIsAddingUser(true)} className="px-6 md:px-10 py-3 md:py-4 bg-[#1e3a8a] text-white rounded-xl font-black shadow-lg shadow-blue-100 flex items-center gap-3 uppercase text-[10px] md:text-xs tracking-widest hover:scale-105 active:scale-95 transition-all">
                            <Plus size={18} /> <span className="hidden md:inline">Add Record</span><span className="md:hidden">Add New</span>
                        </button>
                    )}
                </header>

                {activeTab === "dashboard" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 animate-in fade-in">
                        {[
                            { l: "Total Passes", v: passes.length, c: "blue" },
                            { l: "Total Students", v: students.length, c: "indigo" },
                            { l: "Approved", v: passes.filter(p => p.status === 'approved').length, c: "green" },
                            { l: "Staff", v: advisors.length, c: "purple" }
                        ].map((s, i) => (
                            <div key={i} className="bg-white p-6 md:p-10 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[8px] md:text-[10px] mb-2">{s.l}</p>
                                <p className="text-2xl md:text-4xl font-black text-gray-900">{s.v}</p>
                                <div className={`h-1 w-8 md:w-12 bg-${s.c}-600 mt-4 rounded-full`} />
                            </div>
                        ))}
                        <div className="col-span-2 md:col-span-4 bg-[#1e3a8a]/5 p-8 md:p-16 rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-blue-600/10 text-center">
                            <h3 className="text-gray-400 font-black uppercase tracking-widest text-[10px] italic">System v1.4.2 Active</h3>
                        </div>
                    </div>
                )}

                {(activeTab === "students" || activeTab === "advisors") && (
                    <div className="bg-white rounded-[2rem] shadow-sm border overflow-x-auto animate-in slide-in-from-right-8">
                        <table className="w-full text-left min-w-[900px]">
                            <thead className="bg-[#1e3a8a] text-white">
                                <tr className="uppercase text-[8px] md:text-[10px] tracking-widest font-black">
                                    <th className="px-4 md:px-10 py-4 md:py-6 text-gray-900">Personnel / Unit</th>
                                    <th className="px-4 md:px-10 py-4 md:py-6">Credentials / Contact</th>
                                    <th className="px-4 md:px-10 py-4 md:py-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-bold">
                                {(activeTab === 'students' ? students : advisors).map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 md:px-10 py-1 md:py-8">
                                            <div className="flex items-center gap-4">
                                                {u.profileImg ? (
                                                    <img src={u.profileImg} alt={u.name} className="w-10 h-10 rounded-full object-cover border-2 border-dashed border-gray-200" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-500 text-xs tracking-widest">{u.name.charAt(0)}</div>
                                                )}
                                                <div>
                                                    <div className="font-black text-gray-900 text-xs md:text-sm">{u.name}</div>
                                                    <div className="text-[8px] md:text-[10px] text-gray-400 uppercase mt-1">{(u as Student).rollNo || u.role} | {u.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-10 py-1 md:py-8">
                                            <div className="text-[8px] md:text-[10px] font-mono text-gray-400 mb-2 italic">U: {u.username} | P: {u.password}</div>
                                            <div className="flex gap-2">
                                                {u.role === 'student' ? (
                                                    <>
                                                        <span className="bg-blue-50 text-[#1e3a8a] px-2 py-1 rounded-lg border border-blue-100 text-[8px] italic">S: {(u as Student).studentPhone}</span>
                                                        <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg border border-orange-100 text-[8px] italic">P: {(u as Student).parentPhone}</span>
                                                    </>
                                                ) : (
                                                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-lg border border-green-100 text-[8px] italic">C: {(u as Advisor).phone}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-10 py-1 md:py-8 text-right space-x-2">
                                            <button onClick={() => startEdit(u)} className="p-2 md:p-3 bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg md:rounded-xl shadow-sm transition-all inline-flex items-center"><Plus className="rotate-45" size={16} /></button>
                                            <button onClick={() => GlobalStore.deleteUser(u.id)} className="p-2 md:p-3 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded-lg md:rounded-xl shadow-sm transition-all inline-flex items-center"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === "logs" && (
                    <div className="bg-white rounded-[2rem] shadow-xl border overflow-x-auto text-[10px] uppercase animate-in fade-in">
                        <table className="w-full text-left min-w-[800px] border-collapse">
                            <thead>
                                <tr className="bg-blue-50/50 border-b-2 border-[#1e3a8a] font-black text-[#1e3a8a]">
                                    <th className="px-10 py-6">Student ID</th>
                                    <th className="px-10 py-6">Permission</th>
                                    <th className="px-10 py-6">Status Log</th>
                                    <th className="px-10 py-6">Temporal Window</th>
                                    <th className="px-10 py-6">GPS / Location</th>
                                    <th className="px-10 py-6 text-right">Gate Sync</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                                {[...passes].reverse().map(p => {
                                    const student = users.find(u => u.id === p.studentId);
                                    return (
                                        <tr key={p.id} className="hover:bg-[#1e3a8a]/[0.02]">
                                            <td className="px-10 py-8 font-black text-gray-900">{student?.name || "Deleted User"}</td>
                                            <td className="px-10 py-8">{p.type} Pass</td>
                                            <td className="px-10 py-8">
                                                <span className={`px-4 py-1.5 rounded-full border tracking-tighter ${p.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-10 py-8 font-mono text-[9px]">{p.date}<br/>{p.startTime}-{p.endTime}</td>
                                            <td className="px-10 py-8">
                                                {p.lat && p.lng ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-mono">LAT: {p.lat.toFixed(6)}</span>
                                                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-mono">LNG: {p.lng.toFixed(6)}</span>
                                                        <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" className="text-[8px] text-blue-500 underline uppercase mt-1">View Map</a>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 italic">No GPS Data</span>
                                                )}
                                            </td>
                                            <td className="px-10 py-8 text-right font-mono text-[10px] text-gray-400">
                                                {p.scannedOutAt && <div>Out: {new Date(p.scannedOutAt).toLocaleTimeString()}</div>}
                                                {p.scannedInAt && <div>In: {new Date(p.scannedInAt).toLocaleTimeString()}</div>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}


                {isAddingUser && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-8">
                        <div className="bg-white w-full max-w-2xl rounded-t-[3rem] md:rounded-[3rem] p-8 md:p-16 shadow-2xl relative animate-in slide-in-from-bottom-full md:zoom-in border border-gray-100 max-h-[90vh] overflow-y-auto">
                            <button onClick={resetForm} className="absolute top-6 right-6 p-3 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl"><X size={20} /></button>
                            <h2 className="text-xl md:text-3xl font-black text-[#1e3a8a] mb-8 md:mb-12 uppercase tracking-tighter border-b pb-4">
                                {isEditingUser ? 'Modify Record' : 'Enroll Identity'}
                            </h2>
                            <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-6">
                                <div className="flex items-center justify-center mb-6">
                                    <label className="relative cursor-pointer group">
                                        <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 group-hover:shadow-lg">
                                            {newUser.profileImg ? (
                                                <img src={newUser.profileImg} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-gray-400 font-bold text-[10px] uppercase text-center space-y-1">
                                                    <Plus className="mx-auto text-gray-300" size={20} />
                                                    <span>Add<br/>Photo</span>
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Display Name</label>
                                        <input placeholder="Ex: John Doe" required className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold uppercase text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Institution Dept</label>
                                        <input placeholder="Ex: B.TECH IT" required className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold uppercase text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Portal ID / Username</label>
                                        <input placeholder="Unique ID" required className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Access Password</label>
                                        <input placeholder="Strong Password" required type="password" className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                    </div>
                                </div>
                                {activeTab === 'students' ? (
                                    <>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-1 space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Roll ID</label>
                                                <input placeholder="MAH001" className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold uppercase text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.rollNo} onChange={e => setNewUser({ ...newUser, rollNo: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Year</label>
                                                <input placeholder="1" className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-center text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.year} onChange={e => setNewUser({ ...newUser, year: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Sec</label>
                                                <input placeholder="A" className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-center uppercase text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.section} onChange={e => setNewUser({ ...newUser, section: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Student Mobile</label>
                                                <input placeholder="+91 XXXX" required className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.studentPhone} onChange={e => setNewUser({ ...newUser, studentPhone: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Parent Mobile</label>
                                                <input placeholder="+91 XXXX" required className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.parentPhone} onChange={e => setNewUser({ ...newUser, parentPhone: e.target.value })} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Assigned Class</label>
                                            <input placeholder="CSE-A" className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold uppercase text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.assignedClass} onChange={e => setNewUser({ ...newUser, assignedClass: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Official Mobile</label>
                                            <input placeholder="+91 XXXX" required className="bg-gray-50 w-full h-14 md:h-16 rounded-xl md:rounded-2xl px-6 font-bold text-[10px] md:text-xs outline-none focus:ring-2 ring-blue-100" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                                <button className="w-full py-6 mt-6 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:scale-[0.98] active:scale-95 transition-all">
                                    {isEditingUser ? 'Update Database' : 'Enroll Identity'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
