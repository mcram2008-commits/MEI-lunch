"use client";

import React, { useState, useEffect } from "react";
import { GlobalStore, Pass, Student, Advisor, User } from "@/lib/store";
import {
    ShieldCheck, UserPlus, FileText, Trash2, LogOut, Plus, Search, Filter, ArrowLeft, ArrowRight,
    TrendingUp, Users, ShieldAlert, CheckCircle2, X, Menu, Activity, Pencil, Edit, LayoutDashboard, Database, History, Camera, Info, Building, UserCircle, Phone, Book
} from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminPortal() {
    const [passes, setPasses] = useState<Pass[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "advisors" | "logs">("dashboard");
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [deptFilter, setDeptFilter] = useState("all");
    const [yearFilter, setYearFilter] = useState("all");
    const router = useRouter();

    const [newUser, setNewUser] = useState({
        username: "", password: "", name: "", email: "", role: "student" as any,
        rollNo: "", department: "", year: "", section: "",
        parentPhone: "+91", studentPhone: "+91", phone: "+91", assignedClass: "", profileImg: ""
    });

    useEffect(() => {
        const saved = sessionStorage.getItem("user");
        if (!saved || JSON.parse(saved).role !== "admin") { router.push("/login"); return; }
        const update = () => { setPasses([...GlobalStore.getPasses()]); setUsers([...GlobalStore.getUsers()]); };
        update();
        return GlobalStore.subscribe(update);
    }, [router]);

    const formatPhone = (val: string) => {
        let clean = val.replace(/[^\d+]/g, '');
        if (!clean.startsWith('+91')) {
            if (clean.startsWith('91')) clean = '+' + clean;
            else clean = '+91' + clean;
        }
        return clean.slice(0, 13);
    };

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
        const phoneRegex = /^\+91\d{10}$/;
        const role = activeTab === "students" ? "student" : "advisor";

        if (role === "student") {
            if (!phoneRegex.test(newUser.studentPhone) || !phoneRegex.test(newUser.parentPhone)) {
                alert("Please enter valid 10-digit mobile numbers after +91.");
                return;
            }
        } else {
            if (!phoneRegex.test(newUser.phone)) {
                alert("Please enter a valid 10-digit mobile number after +91.");
                return;
            }
        }
        
        if (newUser.name.toLowerCase().includes("test") || newUser.username.toLowerCase().includes("test")) {
            alert("⚠️ Restriction: Test student creation is not allowed in production.");
            return;
        }

        if (isEditingUser && editingUserId) {
            const updates: any = { username: newUser.username, password: newUser.password, name: newUser.name, email: newUser.email, profileImg: newUser.profileImg };
            if (role === 'student') {
                Object.assign(updates, { rollNo: newUser.rollNo, department: newUser.department, year: newUser.year, section: newUser.section, parentPhone: newUser.parentPhone, studentPhone: newUser.studentPhone });
            } else {
                Object.assign(updates, { department: newUser.department, assignedClass: newUser.assignedClass, phone: newUser.phone });
            }
            GlobalStore.updateUser(editingUserId, updates);
        } else {
            const id = Date.now().toString();
            const userBase = { id, username: newUser.username, password: newUser.password, name: newUser.name, email: newUser.email, role, profileImg: newUser.profileImg };
            if (role === "student") {
                GlobalStore.addUser({ ...userBase, rollNo: newUser.rollNo, department: newUser.department, year: newUser.year, section: newUser.section, parentPhone: newUser.parentPhone, studentPhone: newUser.studentPhone } as Student);
            } else {
                GlobalStore.addUser({ ...userBase, department: newUser.department, assignedClass: newUser.assignedClass, phone: newUser.phone } as Advisor);
            }
        }
        resetForm();
    };

    const resetForm = () => {
        setNewUser({ username: "", password: "", name: "", email: "", role: "student", rollNo: "", department: "", year: "", section: "", parentPhone: "+91", studentPhone: "+91", phone: "+91", assignedClass: "", profileImg: "" });
        setIsAddingUser(false);
        setIsEditingUser(false);
        setEditingUserId(null);
    };

    const startEdit = (user: any) => {
        setNewUser({
            username: user.username, password: user.password, name: user.name, email: user.email || "", role: user.role,
            rollNo: user.rollNo || "", department: user.department || "", year: user.year || "", section: user.section || "",
            parentPhone: user.parentPhone || "+91", studentPhone: user.studentPhone || "+91", phone: user.phone || "+91", assignedClass: user.assignedClass || "",
            profileImg: user.profileImg || ""
        });
        setEditingUserId(user.id);
        setIsEditingUser(true);
        setIsAddingUser(true);
    };

    const handleLogout = () => { sessionStorage.clear(); router.push("/login"); };

    const generatePDF = () => {
        const doc = new jsPDF();
        const timestamp = new Date().toLocaleString();
        
        doc.setFontSize(22);
        doc.text("MEI HOSTEL SYSTEM - OFFICIAL REPORT", 20, 20);
        doc.setFontSize(10);
        doc.text(`Generated on: ${timestamp}`, 20, 30);
        doc.text(`Category: ${activeTab.toUpperCase()}`, 20, 35);
        
        let tableTitle = "";
        let head: string[][] = [];
        let body: string[][] = [];

        if (activeTab === 'students') {
            tableTitle = "Student Registration Record";
            head = [['Name', 'Roll No', 'Dept', 'Year', 'Parent Phone']];
            body = students
                .filter(u => deptFilter === "all" || u.department === deptFilter)
                .filter(u => yearFilter === "all" || u.year === yearFilter)
                .map(s => [s.name, s.rollNo, s.department, s.year, s.parentPhone]);
        } else if (activeTab === 'advisors') {
            tableTitle = "Faculty & Staff Directory";
            head = [['Name', 'Dept', 'Class', 'Phone', 'Email']];
            body = advisors
                .filter(u => deptFilter === "all" || u.department === deptFilter)
                .map(a => [a.name, a.department, a.assignedClass, a.phone, a.email || "N/A"]);
        } else if (activeTab === 'logs') {
            tableTitle = "Activity & Gate Logs";
            head = [['Student', 'Type', 'Date', 'Out', 'In', 'Status']];
            body = [...passes].reverse().filter(p => {
                const s = users.find(u => u.id === p.studentId) as Student;
                if (!s) return true;
                return (deptFilter === 'all' || s.department === deptFilter) && (yearFilter === 'all' || s.year === yearFilter);
            }).map(p => {
                const s = users.find(u => u.id === p.studentId);
                return [s?.name || "Deleted", p.type, p.date, p.scannedOutAt ? new Date(p.scannedOutAt).toLocaleTimeString() : '-', p.scannedInAt ? new Date(p.scannedInAt).toLocaleTimeString() : '-', p.status];
            });
        }

        doc.setFontSize(14);
        doc.text(tableTitle, 20, 50);

        autoTable(doc, {
            startY: 60,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138] },
        });

        doc.save(`MEI_Report_${activeTab}_${Date.now()}.pdf`);
    };

    const students = users.filter(u => u.role === "student") as Student[];
    const advisors = users.filter(u => u.role === "advisor") as Advisor[];

    return (
        <div className="min-h-screen bg-[#f3f4f9] flex">
            {/* Sidebar Menu (Student Style Dark) */}
            <aside className={`fixed inset-y-0 left-0 h-full w-[280px] bg-[#333333] z-50 shadow-2xl transition-transform duration-300 transform ${isMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 border-r border-[#444]"}`}>
                <div className="flex flex-col h-full">
                    <div className="bg-gradient-to-r from-[#1e3a8a] to-[#5b21b6] p-10 flex flex-col items-center justify-center text-white">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 p-2 shadow-lg">
                            <div className="w-full h-full bg-[#1e3a8a] rounded-full flex items-center justify-center font-black">MEI</div>
                        </div>
                        <p className="font-bold text-lg uppercase tracking-widest text-[#fff]">Admin Portal</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-2 mt-4 text-white">
                        {[
                            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
                            { id: 'students', label: 'Student Management', icon: <Users size={20} /> },
                            { id: 'advisors', label: 'Faculty Control', icon: <ShieldAlert size={20} /> },
                            { id: 'logs', label: 'Activity Logs', icon: <History size={20} /> }
                        ].map(nav => (
                            <button
                                key={nav.id}
                                onClick={() => { setActiveTab(nav.id as any); setIsMenuOpen(false); }}
                                className={`w-full flex items-center gap-6 p-4 rounded-xl font-medium transition-colors ${activeTab === nav.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="w-6 text-blue-400">{nav.icon}</div>
                                <span className="text-xs uppercase font-bold tracking-widest">{nav.label}</span>
                            </button>
                        ))}
                        
                        <div className="my-8 h-[1px] bg-white/10" />

                        <button 
                            onClick={() => {
                                if(confirm("Are you sure you want to PERMANENTLY delete ALL pass history?")) {
                                    GlobalStore.resetHistory();
                                    alert("Pass history has been reset.");
                                }
                            }}
                            className="w-full flex items-center gap-6 p-4 rounded-xl font-medium text-orange-200 hover:bg-orange-500/10 transition-colors"
                        >
                            <div className="w-6"><Database size={20} /></div>
                            <span className="text-xs uppercase font-bold tracking-widest">Wipe Data</span>
                        </button>

                        <button onClick={handleLogout} className="w-full flex items-center gap-6 p-4 rounded-xl font-medium text-red-100 hover:bg-red-500/10 transition-colors">
                            <div className="w-6"><LogOut size={20} /></div>
                            <span className="text-xs uppercase font-bold tracking-widest">Logout</span>
                        </button>
                    </nav>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="fixed top-0 bg-gradient-to-r from-[#1e3a8a] to-[#5b21b6] text-white w-full h-16 flex items-center px-6 z-[60] lg:hidden">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -ml-2">
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h1 className="ml-6 font-bold text-lg tracking-tight uppercase">Admin Dashboard</h1>
            </header>

            {/* Main Area */}
            <main className={`flex-1 min-h-screen pt-24 lg:pt-0 lg:ml-[280px] p-6 lg:p-12 transition-all duration-300`}>
                <div className="grid grid-cols-1 gap-8 animate-in fade-in">
                    {/* Header Title (Blue/Black style) */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-[#1e3a8a] uppercase tracking-tighter">{activeTab}</h2>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 italic">Institutional Oversight System</p>
                            </div>
                            
                            {activeTab !== 'dashboard' && (
                                <div className="flex items-center gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Department</p>
                                        <select 
                                            value={deptFilter} 
                                            onChange={(e) => setDeptFilter(e.target.value)}
                                            className="bg-white border rounded-lg px-3 py-2 text-xs font-bold text-[#1e3a8a] outline-none"
                                        >
                                            <option value="all">ALL DEPTS</option>
                                            {Array.from(new Set(users.map(u => (u as any).department))).filter(Boolean).sort().map(d => (
                                                <option key={d as string} value={d as string}>{d as string}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {activeTab === 'students' && (
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Year</p>
                                            <select 
                                                value={yearFilter} 
                                                onChange={(e) => setYearFilter(e.target.value)}
                                                className="bg-white border rounded-lg px-3 py-2 text-xs font-bold text-[#1e3a8a] outline-none"
                                            >
                                                <option value="all">ALL YEARS</option>
                                                {["I", "II", "III", "IV", "1", "2", "3", "4"].map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {(activeTab === 'students' || activeTab === 'advisors' || activeTab === 'logs') && (
                            <div className="flex gap-4">
                                <button 
                                    onClick={generatePDF}
                                    className="bg-white text-[#1e3a8a] border-2 border-[#1e3a8a] px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 active:scale-95 transition-all shadow-sm"
                                >
                                    <FileText size={18} /> Download PDF
                                </button>
                                {activeTab !== 'logs' && (
                                    <button 
                                        onClick={() => setIsAddingUser(true)}
                                        className="bg-[#1e3a8a] text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 flex items-center gap-3 active:scale-95 transition-all"
                                    >
                                        <Plus size={18} /> Add {activeTab === 'students' ? 'Student' : 'Advisor'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {activeTab === "dashboard" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { l: "Pass History", v: passes.length, icon: <FileText size={24} className="text-[#1e3a8a]" />, bg: "bg-blue-50" },
                                { l: "Total Students", v: students.length, icon: <Users size={24} className="text-purple-600" />, bg: "bg-purple-50" },
                                { l: "Approved Passes", v: passes.filter(p => p.status === 'approved').length, icon: <CheckCircle2 size={24} className="text-green-600" />, bg: "bg-green-50" },
                                { l: "Faculty Count", v: advisors.length, icon: <ShieldCheck size={24} className="text-orange-600" />, bg: "bg-orange-50" }
                            ].map((s, i) => (
                                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border flex flex-col items-center text-center">
                                    <div className={`${s.bg} p-4 rounded-xl mb-6`}>{s.icon}</div>
                                    <p className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2">{s.l}</p>
                                    <p className="text-4xl font-black text-gray-900 tracking-tighter">{s.v}</p>
                                </div>
                            ))}
                            
                            <div className="md:col-span-2 lg:col-span-4 bg-white p-10 rounded-2xl border-2 border-dashed border-blue-100 flex items-center justify-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300 italic">Global System Status: Secure and Monitored</p>
                            </div>
                        </div>
                    )}

                    {(activeTab === "students" || activeTab === "advisors") && (
                        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest">User Details</th>
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest text-center">Credentials</th>
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(() => {
                                            const filtered = (activeTab === 'students' ? students : advisors)
                                                .filter(u => deptFilter === "all" || (u as any).department === deptFilter)
                                                .filter(u => activeTab !== 'students' || yearFilter === "all" || (u as Student).year === yearFilter);

                                            // Sort by Department, then Year (for students)
                                            const sorted = [...filtered].sort((a, b) => {
                                                const dComp = (a as any).department.localeCompare((b as any).department);
                                                if (dComp !== 0) return dComp;
                                                if (activeTab === 'students') {
                                                    return ((a as Student).year || "").localeCompare((b as Student).year || "");
                                                }
                                                return 0;
                                            });

                                            let currentDept = "";
                                            let currentYear = "";

                                            return sorted.map((u, idx) => {
                                                const showDeptHeader = (u as any).department !== currentDept;
                                                const showYearHeader = activeTab === 'students' && ((u as Student).year !== currentYear || showDeptHeader);
                                                currentDept = (u as any).department;
                                                if (activeTab === 'students') currentYear = (u as Student).year || "";

                                                return (
                                                    <React.Fragment key={u.id}>
                                                        {showDeptHeader && (
                                                            <tr className="bg-gray-100/50">
                                                                <td colSpan={3} className="px-8 py-3 text-[9px] font-black text-blue-600 uppercase tracking-[0.3em]">
                                                                    Department: {currentDept || "UNASSIGNED"}
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {showYearHeader && (
                                                            <tr className="bg-white">
                                                                <td colSpan={3} className="px-10 py-2 text-[8px] font-black text-gray-400 uppercase tracking-widest border-l-4 border-gray-200">
                                                                    Year: {currentYear || "N/A"}
                                                                </td>
                                                            </tr>
                                                        )}
                                                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-8 py-8">
                                                                <div className="flex items-center gap-6">
                                                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-[#1e3a8a] text-xl border shadow-inner overflow-hidden">
                                                                        {u.profileImg ? <img src={u.profileImg} className="w-full h-full object-cover" alt="Profile" /> : u.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-gray-900 text-lg tracking-tight uppercase">{u.name}</div>
                                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                                                            {(u as Student).rollNo || "ADMIN"} | {u.department} { (u as Student).year ? `| YEAR ${ (u as Student).year }` : '' }
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-8 text-center">
                                                                <div className="bg-gray-100 px-4 py-3 rounded-xl inline-block text-[10px] font-black text-[#1e3a8a]">
                                                                    {u.username} | {u.password}
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-8 text-right flex items-center justify-end gap-3">
                                                                <button onClick={() => startEdit(u)} className="p-3 bg-blue-50 text-[#1e3a8a] rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit size={18} /></button>
                                                                <button onClick={() => { if(confirm("Are you sure?")) GlobalStore.deleteUser(u.id); }} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "logs" && (
                        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[900px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest">Student</th>
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest">Time Information</th>
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest text-center">Verification</th>
                                            <th className="px-8 py-6 text-[#1e3a8a] text-[10px] font-black uppercase tracking-widest text-right">Gate Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(() => {
                                            const filtered = [...passes].reverse().filter(p => {
                                                const student = users.find(u => u.id === p.studentId) as Student;
                                                if (!student) return true;
                                                const matchesDept = deptFilter === "all" || student.department === deptFilter;
                                                const matchesYear = yearFilter === "all" || student.year === yearFilter;
                                                return matchesDept && matchesYear;
                                            });

                                            // Group by Department
                                            const sorted = [...filtered].sort((a, b) => {
                                                const sA = users.find(u => u.id === a.studentId) as Student;
                                                const sB = users.find(u => u.id === b.studentId) as Student;
                                                if (!sA || !sB) return 0;
                                                return sA.department.localeCompare(sB.department);
                                            });

                                            let currentDept = "";

                                            return sorted.map(p => {
                                                const student = users.find(u => u.id === p.studentId) as Student;
                                                const showDeptHeader = student && student.department !== currentDept;
                                                if (student) currentDept = student.department;

                                                return (
                                                    <React.Fragment key={p.id}>
                                                        {showDeptHeader && (
                                                            <tr className="bg-gray-100/50">
                                                                <td colSpan={4} className="px-8 py-3 text-[9px] font-black text-blue-600 uppercase tracking-[0.3em]">
                                                                    Log Section: {currentDept}
                                                                </td>
                                                            </tr>
                                                        )}
                                                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-8 py-8">
                                                                <div className="flex items-center gap-5">
                                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-black text-gray-500 text-xs">
                                                                        {student?.profileImg ? <img src={student.profileImg} className="w-full h-full object-cover rounded-lg" alt="S" /> : student?.name.charAt(0) || "?"}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-black text-gray-900 uppercase">{student?.name || "Deleted Student"}</p>
                                                                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">{p.type} Pass {p.id}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-8">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-xs font-black text-gray-700">{p.date}</span>
                                                                    <span className="text-gray-400 font-bold text-[10px] uppercase">{p.startTime} — {p.endTime}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-8 text-center text-[10px] font-black uppercase italic text-gray-400">
                                                                {p.lat ? "GPS Verified" : "Manual Log"}
                                                            </td>
                                                            <td className="px-8 py-8 text-right">
                                                                <div className="flex flex-col gap-2 items-end">
                                                                    <div className={`text-[9px] font-black px-3 py-1 rounded-lg ${p.scannedOutAt ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-300'}`}>
                                                                        EX: {p.scannedOutAt ? new Date(p.scannedOutAt).toLocaleTimeString() : '---'}
                                                                    </div>
                                                                    <div className={`text-[9px] font-black px-3 py-1 rounded-lg ${p.scannedInAt ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`}>
                                                                        EN: {p.scannedInAt ? new Date(p.scannedInAt).toLocaleTimeString() : '---'}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Overlay (Student Style Modal) */}
                {isAddingUser && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-8 bg-gradient-to-r from-[#1e3a8a] to-[#5b21b6] text-white flex justify-between items-center">
                                <h2 className="text-xl font-black uppercase tracking-tight">Record {isEditingUser ? 'Edit' : 'Enrollment'}</h2>
                                <button onClick={resetForm} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X size={20} /></button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="p-8 lg:p-12 overflow-y-auto no-scrollbar space-y-8">
                                <div className="flex justify-center mb-4">
                                    <label className="relative cursor-pointer">
                                        <div className="w-28 h-28 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:border-[#1e3a8a] transition-colors">
                                            {newUser.profileImg ? (
                                                <img src={newUser.profileImg} className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <Camera size={24} className="text-gray-300 mb-1" />
                                                    <span className="text-[8px] font-black text-gray-400 uppercase">Selfie/Photo</span>
                                                </>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <input placeholder="ENTER NAME" required className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold outline-none focus:ring-2 ring-blue-100" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Department</label>
                                        <input placeholder="Ex: IT" required className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold outline-none focus:ring-2 ring-blue-100" value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                                        <input placeholder="USER_ID" required className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold outline-none focus:ring-2 ring-blue-100" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                                        <input placeholder="PASSWORD" required type="text" className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold outline-none focus:ring-2 ring-blue-100" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                                        <input placeholder="Ex: advisor@mei.hostel" required type="email" className="w-full h-14 bg-gray-100 rounded-xl px-5 font-bold outline-none focus:ring-2 ring-blue-100" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                    </div>
                                </div>

                                {activeTab === 'students' ? (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Roll No</label>
                                                <input placeholder="MAHXXX" className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold text-center" value={newUser.rollNo} onChange={e => setNewUser({ ...newUser, rollNo: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Year</label>
                                                <input placeholder="III" className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold text-center" value={newUser.year} onChange={e => setNewUser({ ...newUser, year: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Section</label>
                                                <input placeholder="A" className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold text-center uppercase" value={newUser.section} onChange={e => setNewUser({ ...newUser, section: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Student Phone</label>
                                                <input placeholder="+91" required className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold" value={newUser.studentPhone} onChange={e => setNewUser({ ...newUser, studentPhone: formatPhone(e.target.value) })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Parent Phone</label>
                                                <input placeholder="+91" required className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold" value={newUser.parentPhone} onChange={e => setNewUser({ ...newUser, parentPhone: formatPhone(e.target.value) })} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Class</label>
                                            <input placeholder="Ex: CSE-B" className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold uppercase" value={newUser.assignedClass} onChange={e => setNewUser({ ...newUser, assignedClass: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile No</label>
                                            <input placeholder="+91" required className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: formatPhone(e.target.value) })} />
                                        </div>
                                    </div>
                                )}
                                
                                <button className="w-full h-18 py-6 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-4 active:scale-95 transition-all">
                                    <CheckCircle2 size={20} /> Commit record
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
