"use client";

import { useState, useEffect, useCallback } from "react";
import { GlobalStore, Pass, User, Student } from "@/lib/store";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
    ShieldCheck, QrCode, Scan, LogOut, CheckCircle, XCircle,
    User as UserIcon, Clock, ChevronRight, Menu, X, ShieldAlert,
    Camera, History, CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function WatchmanPortal() {
    const [scanResult, setScanResult] = useState<any>(null);
    const [studentInfo, setStudentInfo] = useState<Student | null>(null);
    const [passInfo, setPassInfo] = useState<Pass | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [logs, setLogs] = useState<Pass[]>([]);
    
    const router = useRouter();

    useEffect(() => {
        const savedUser = sessionStorage.getItem("user");
        if (!savedUser) { router.push("/login"); return; }
        const user = JSON.parse(savedUser) as User;
        if (user.role !== "watchman") { router.push("/login"); return; }

        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 280 }, false);
        scanner.render(onScanSuccess, (e) => {});

        const update = () => {
            const allPasses = GlobalStore.getPasses();
            setLogs(allPasses.filter(p => p.scannedInAt || p.scannedOutAt)
                         .sort((a, b) => new Date(b.scannedInAt || b.scannedOutAt || 0).getTime() - new Date(a.scannedInAt || a.scannedOutAt || 0).getTime()));
        };
        update();
        const unsub = GlobalStore.subscribe(update);

        return () => { scanner.clear(); unsub(); };
    }, [router]);

    const onScanSuccess = useCallback((result: string) => {
        try {
            const data = JSON.parse(result);
            if (!data.id) throw new Error("Invalid Pass");
            
            const pass = GlobalStore.getPasses().find(p => p.id === data.id);
            if (!pass) { alert("🚨 Pass Record Not Found in Database"); return; }
            
            const student = GlobalStore.getUsers().find(u => u.id === pass.studentId) as Student;
            setScanResult(data);
            setPassInfo(pass);
            setStudentInfo(student);
        } catch (e) {
            alert("⚠️ Unrecognized QR Signature. Authorization Refused.");
        }
    }, []);

    const handleAction = (type: "in" | "out") => {
        if (!passInfo) return;

        if (type === "out") {
            GlobalStore.updatePass(passInfo.id, {
                scannedOutAt: new Date().toISOString(),
                status: "approved" // Keep as approved so the student can still see the pass for selfie verification
            });
        } else {
            GlobalStore.updatePass(passInfo.id, {
                scannedInAt: new Date().toISOString(),
                // For lunch passes, we don't mark 'used' until face verification done in student portal
                // But for leave, maybe we do. Request says selfie check is return, so we stay approved here.
                status: "approved" 
            });
        }
        
        alert(`SUCCESS: Gate ${type.toUpperCase()} recorded.`);
        setScanResult(null);
        setPassInfo(null);
        setStudentInfo(null);
    };

    const handleLogout = () => { sessionStorage.clear(); router.push("/login"); };

    return (
        <div className="min-h-screen bg-[#f3f4f9] pb-10">
            {/* Nav Header */}
            <header className="fixed top-0 bg-white shadow-xl shadow-blue-100/30 w-full h-20 flex items-center justify-between px-8 z-50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#1e3a8a] text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-200">W</div>
                    <div>
                        <h1 className="font-bold text-lg text-gray-900 leading-tight">GATE SECURITY</h1>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5 border-t border-gray-100 pt-1">Entry/Exit Control</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all scale-100 active:scale-95 shadow-sm">
                    <LogOut size={20} />
                </button>
            </header>

            <main className="max-w-6xl mx-auto pt-32 px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Scanner Section */}
                    <section className="space-y-8">
                        <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-[#1e3a8a] text-white px-8 py-3 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <Scan size={14} className="animate-pulse" /> LIVE SCANNER
                            </div>
                            
                            <h2 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tighter mb-8 italic">Authentication Node</h2>
                            
                            <div id="reader" className="w-full h-[400px] bg-gray-50 rounded-[2.5rem] overflow-hidden border-2 border-dashed border-gray-200 group-hover:border-blue-200 transition-all"></div>
                            
                            <div className="mt-8 flex items-center gap-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100/30">
                                <div className="p-3 bg-blue-100 text-[#1e3a8a] rounded-xl"><ShieldCheck size={24} /></div>
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-relaxed">
                                    Aligned encrypted QR code within the focus area to authorize entry or exit operations.
                                </p>
                            </div>
                        </div>

                        {/* Recent Activity Mini-Feed */}
                        <div className="bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-white/50">
                             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><History size={14} /> Local Session Feed</h3>
                             <div className="space-y-3">
                                {logs.slice(0, 3).map(l => (
                                    <div key={l.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><CheckCircle2 size={16} className="text-blue-600" /></div>
                                            <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight">{GlobalStore.getUsers().find(u => u.id === l.studentId)?.name}</span>
                                        </div>
                                        <span className="text-[8px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">{new Date(l.scannedInAt || l.scannedOutAt || "").toLocaleTimeString()}</span>
                                    </div>
                                ))}
                             </div>
                        </div>
                    </section>

                    {/* Verification Result Section */}
                    <section>
                        {scanResult ? (
                            <div className="bg-white rounded-[3rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500 h-full flex flex-col">
                                <div className={`h-4 ${passInfo?.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <div className="p-10 md:p-12 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-10">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2 italic">Verification Passed</p>
                                            <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-none">{studentInfo?.name}</h3>
                                            <p className="text-xs font-bold text-gray-400 mt-2">{studentInfo?.rollNo} | {studentInfo?.department}</p>
                                        </div>
                                        {studentInfo?.profileImg ? (
                                            <img src={studentInfo.profileImg} className="w-24 h-24 rounded-3xl object-cover border-4 border-gray-50 shadow-xl" alt="P" />
                                        ) : (
                                            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300"><UserIcon size={40} /></div>
                                        )}
                                    </div>

                                    <div className="bg-gray-50/80 rounded-[2.5rem] p-8 space-y-6 mb-10 border border-gray-100">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-[#1e3a8a]">
                                            <span>Pass Identity</span>
                                            <span>#{passInfo?.id.slice(-6)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white p-6 rounded-3xl text-center shadow-sm border border-gray-100">
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Operation Type</p>
                                                <p className={`font-black uppercase text-xs ${passInfo?.type === 'lunch' ? 'text-blue-600' : 'text-purple-600'}`}>{passInfo?.type} Pass</p>
                                            </div>
                                            <div className="bg-white p-6 rounded-3xl text-center shadow-sm border border-gray-100">
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Status Node</p>
                                                <p className="font-black uppercase text-green-600 text-xs">{passInfo?.status}</p>
                                            </div>
                                        </div>
                                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Time Slot Range</p>
                                                <p className="font-black text-gray-900 text-sm">{passInfo?.startTime} - {passInfo?.endTime}</p>
                                            </div>
                                            <Clock size={24} className="text-gray-200" />
                                        </div>
                                    </div>

                                    <div className="mt-auto grid grid-cols-2 gap-6">
                                        <button 
                                            onClick={() => handleAction("out")}
                                            className="group relative flex flex-col items-center gap-3 p-8 bg-[#1e3a8a] text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <LogOut size={24} className="rotate-180" /> SCAN OUT (EXIT)
                                        </button>
                                        <button 
                                            onClick={() => handleAction("in")}
                                            className="group relative flex flex-col items-center gap-3 p-8 bg-green-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <ShieldCheck size={24} /> SCAN IN (ENTRY)
                                        </button>
                                    </div>
                                    
                                    <button onClick={() => setScanResult(null)} className="mt-6 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] hover:text-gray-900 transition-colors">Discard & Resume Scan</button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full bg-white/50 backdrop-blur-md rounded-[4rem] border-4 border-dashed border-white flex flex-col items-center justify-center p-16 text-center animate-in fade-in zoom-in-95 duration-700">
                                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-inner border shadow-gray-200/50">
                                    <QrCode size={48} className="text-gray-200 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-black text-gray-400 uppercase tracking-tighter mb-4">Awaiting Signal</h3>
                                <p className="text-sm font-bold text-gray-300 leading-relaxed uppercase italic tracking-widest max-w-xs">
                                    Digital handshake initialized.<br/>Scan QR code to verify identity.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
