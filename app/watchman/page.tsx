"use client";

import { useState, useEffect } from "react";
import { GlobalStore, MOCK_STUDENTS, Pass, User } from "@/lib/store";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
    ShieldCheck, LogOut, AlertCircle, CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SimpleWatchman() {
    const [watchman, setWatchman] = useState<User | null>(null);
    const [activeScreen, setActiveScreen] = useState<"scan" | "details" | "error">("scan");
    const [currentPassId, setCurrentPassId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const router = useRouter();

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        if (!savedUser) { router.push("/login"); return; }
        const user = JSON.parse(savedUser) as User;
        if (user.role !== "watchman") { router.push("/login"); return; }
        setWatchman(user);
    }, [router]);

    // Force re-render when store changes
    const [tick, setTick] = useState(0);
    useEffect(() => {
        return GlobalStore.subscribe(() => setTick(t => t + 1));
    }, []);

    useEffect(() => {
        if (!watchman || activeScreen !== "scan") return;

        const { Html5Qrcode } = require("html5-qrcode");
        const html5QrCode = new Html5Qrcode("reader");
        
        const startScanner = async () => {
            try {
                const element = document.getElementById("reader");
                if (!element) return;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 15, qrbox: { width: 300, height: 300 } },
                    (decodedText: string) => {
                        let passId = decodedText.trim();
                        try {
                            const data = JSON.parse(decodedText);
                            if (data.id) passId = data.id;
                        } catch (e) {}

                        const passes = GlobalStore.getPasses();
                        const pass = passes.find(p => p.id === passId);
                        
                        if (pass) {
                            setCurrentPassId(pass.id);
                            
                            // AUTOMATIC LOGGING - No manual click required
                            const actionType = watchman.id === "watchman2" ? 'exit' : 'entry';
                            GlobalStore.updatePass(pass.id, {
                                scannedOutAt: actionType === 'exit' ? new Date().toISOString() : pass.scannedOutAt,
                                scannedInAt: actionType === 'entry' ? new Date().toISOString() : pass.scannedInAt,
                                status: "approved",
                            });

                            setActiveScreen("details");
                            html5QrCode.stop().catch(() => {});

                            // AUTO-RESET: Return to scanner automatically after 2.5 seconds
                            setTimeout(() => {
                                setActiveScreen("scan");
                                setCurrentPassId(null);
                            }, 2500);
                        } else {
                            setErrorMessage(`Pass ID ${passId} not found.`);
                            setActiveScreen("error");
                            html5QrCode.stop().catch(() => {});
                        }
                    },
                    (err: any) => {}
                );
            } catch (err: any) {}
        };

        const timeoutId = setTimeout(startScanner, 300);

        return () => {
            clearTimeout(timeoutId);
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {});
            }
        };
    }, [watchman, activeScreen]);

    const currentPass = GlobalStore.getPasses().find(p => p.id === currentPassId);
    const studentForPass = MOCK_STUDENTS().find(s => s.id === currentPass?.studentId);

    const logout = () => { localStorage.removeItem("user"); router.push("/login"); };

    if (!watchman) return null;

    return (
        <div className="min-h-screen bg-[#f3f4f9] pb-10">
            <header className="fixed top-0 bg-[#1e3a8a] text-white w-full h-16 flex items-center px-6 z-50 shadow-md">
                <ShieldCheck size={24} />
                <h1 className="ml-4 font-bold text-lg tracking-tight uppercase">Gate Check</h1>
                <button onClick={logout} className="ml-auto p-2 opacity-70 hover:opacity-100 transition-opacity"><LogOut size={20} /></button>
            </header>

            <main className="pt-24 px-6 max-w-lg mx-auto">
                {activeScreen === "scan" && (
                    <div className="animate-in fade-in py-10 space-y-12 text-center">
                        <div>
                            <h2 className="text-3xl font-black text-[#1e3a8a] mb-2 tracking-tight">Scanner Ready</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-6">Hands-free Automatic Logging</p>
                            <p className="text-[10px] font-black text-blue-600 uppercase mt-2 italic">Scanning for {watchman.id === "watchman2" ? 'EXIT (GATE 2)' : 'ENTRY (GATE 1)'}</p>
                        </div>

                        <div className="w-full aspect-square bg-[#333] rounded-[3rem] overflow-hidden border-[12px] border-white shadow-2xl relative shadow-blue-100/50">
                            <div id="reader" className="w-full h-full scale-[1.05]"></div>
                            <div className="absolute inset-x-0 top-1/2 h-[2px] bg-orange-500/40 animate-bounce pointer-events-none" />
                        </div>

                        <div className="bg-white p-6 rounded-2xl flex items-center gap-4 border shadow-sm mx-auto w-fit">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Scanning QR Token...</p>
                        </div>
                    </div>
                )}

                {activeScreen === "error" && (
                    <div className="animate-in zoom-in text-center py-24 bg-white rounded-[3rem] p-10 shadow-xl border border-red-50">
                        <AlertCircle size={80} className="text-red-500 mx-auto mb-10" />
                        <h2 className="text-3xl font-black text-gray-900 mb-6 uppercase tracking-widest text-red-600">Invalid QR</h2>
                        <div className="p-6 bg-red-50 text-red-600 font-bold mb-12 rounded-2xl italic">
                            {errorMessage}
                        </div>
                        <button onClick={() => setActiveScreen("scan")} className="w-full h-18 py-6 bg-red-600 text-white rounded-3xl font-black text-lg tracking-widest shadow-xl shadow-red-100 uppercase">Return to Scanner</button>
                    </div>
                )}

                {activeScreen === "details" && currentPass && (
                    <div className="animate-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-white rounded-[3rem] p-10 space-y-10 shadow-2xl overflow-hidden relative border border-gray-50">
                            <div className="absolute top-0 inset-x-0 h-3 bg-green-500" />

                            <div className="flex flex-col items-center gap-6 border-b pb-10 relative">
                                <div className="absolute -top-14 right-0 px-6 py-3 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl bg-green-600 text-white flex items-center gap-2">
                                    <CheckCircle2 size={16} /> Auto Registered
                                </div>
                                <div className="w-40 h-40 bg-[#1e3a8a] text-white rounded-[2.5rem] flex items-center justify-center font-black text-5xl shadow-2xl overflow-hidden border-8 border-green-50">
                                    {studentForPass?.profileImg ? (
                                        <img src={studentForPass.profileImg} className="w-full h-full object-cover" alt="Profile" />
                                    ) : (
                                        <span>{studentForPass?.name?.[0] || "?"}</span>
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className="text-3xl font-black text-gray-900 mb-1 leading-tight">{studentForPass?.name || "Student Name Missing"}</h3>
                                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                                        {studentForPass ? `${studentForPass.rollNo} | ${studentForPass.department}` : "System ID: " + currentPass.studentId}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-green-50 p-6 rounded-3xl border-2 border-green-200 text-center animate-pulse">
                                    <p className="text-xs font-black text-green-700 uppercase tracking-widest mb-1">Status Logged</p>
                                    <p className="text-xl font-black text-green-800">
                                        STUDENT {watchman.id === "watchman2" ? 'EXIT RECORDED' : 'ENTRY RECORDED'}
                                    </p>
                                    <p className="text-[10px] font-bold text-green-600 mt-2 italic uppercase">Resuming Scanner Automatically...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
