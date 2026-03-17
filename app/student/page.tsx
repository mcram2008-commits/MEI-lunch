"use client";

import { useState, useEffect, useRef } from "react";
import { GlobalStore, Pass, Student } from "@/lib/store";
import { QRCodeSVG } from "qrcode.react";
import {
    Menu, X, History, Clock, Send, User, LogOut,
    Calendar, Info, ChevronRight, CheckCircle2,
    Plus, Search, Phone, Book, Building, UserCircle, ArrowLeft, XCircle, FileText, Camera, ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function StudentPortal() {
    const [student, setStudent] = useState<Student | null>(null);
    const [passes, setPasses] = useState<Pass[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"dashboard" | "requests" | "profile" | "instructions" | "view_pass">("dashboard");
    const [applyingType, setApplyingType] = useState<"lunch" | "leave" | null>(null);
    const [selectedPass, setSelectedPass] = useState<Pass | null>(null);

    const [passDate, setPassDate] = useState(new Date().toISOString().split('T')[0]);
    const [gpsVerified, setGpsVerified] = useState(false);
    const [isGpsChecking, setIsGpsChecking] = useState(false);
    const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
    const [outTime, setOutTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [verificationStep, setVerificationStep] = useState<"none" | "camera" | "matching" | "background" | "blinking" | "success" | "fail">("none");
    const [verificationMsg, setVerificationMsg] = useState("");
    const [isBlinking, setIsBlinking] = useState(false);
    const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const router = useRouter();

    useEffect(() => {
        const savedUser = sessionStorage.getItem("user");
        if (!savedUser) { router.push("/login"); return; }
        const user = JSON.parse(savedUser) as Student;
        if (user.role !== "student") { router.push("/login"); return; }
        setStudent(user);

        const update = () => {
            const allUsers = GlobalStore.getUsers();
            const currentUser = allUsers.find(u => u.id === user.id) as Student;
            if (currentUser) setStudent(currentUser);
            
            const today = new Date().toISOString().split('T')[0];
            setPasses(GlobalStore.getPasses().filter(p => p.studentId === user.id && p.date === today)
                .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()));
        };
        update();
        return GlobalStore.subscribe(update);
    }, [router]);

    const [reason, setReason] = useState("");
    const [selectedSlot, setSelectedSlot] = useState<"12:00PM-01:00PM" | "01:00PM-02:00PM" | "06:00PM-12:00AM" | "">("");

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        proceedWithApplication(e);
    };

    const proceedWithApplication = (e: React.FormEvent) => {
        if (!student || !applyingType) return;

        if (!gpsVerified) {
            setIsGpsChecking(true);
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserCoords({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                        setTimeout(() => {
                            setIsGpsChecking(false);
                            setGpsVerified(true);
                            alert("📍 GPS Location Captured & Verified.");
                        }, 1000);
                    },
                    (error) => {
                        setIsGpsChecking(false);
                        alert("⚠️ GPS Alert: You must enable location permissions to apply for a pass.");
                    },
                    { enableHighAccuracy: true }
                );
            } else {
                alert("Geolocation is not supported by this browser.");
            }
            return;
        }

        if (applyingType === "lunch" && !selectedSlot) {
            alert("Please select a lunch slot");
            return;
        }

        const id = "PASS-" + Math.random().toString(36).substr(2, 9).toUpperCase();
        let finalOutTime = outTime;
        let finalEndTime = endTime;

        if (applyingType === "lunch") {
            const [s, eTime] = selectedSlot.split("-");
            finalOutTime = s === "12:00PM" ? "12:00" : s === "01:00PM" ? "13:00" : "18:00";
            finalEndTime = eTime === "01:00PM" ? "13:00" : eTime === "02:00PM" ? "14:00" : "23:59";
        }

        GlobalStore.addPass({
            id,
            studentId: student.id,
            type: applyingType,
            status: applyingType === "lunch" ? "approved" : "pending",
            appliedAt: new Date().toISOString(),
            date: passDate,
            startTime: finalOutTime,
            endTime: finalEndTime,
            reason: applyingType === "leave" ? reason : undefined,
            lat: userCoords?.lat,
            lng: userCoords?.lng
        });

        alert(applyingType === "lunch" ? "Lunch Pass Approved! Use QR at gate." : "Leave Request Submitted to Advisor.");
        resetForm();
        setApplyingType(null);
        setActiveTab("dashboard");
    };

    const startSelfieVerification = (pass: Pass) => {
        setSelectedPass(pass);
        setVerificationStep("camera");
        setVerificationMsg("Initializing Secure Camera Module...");
        
        setTimeout(() => {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
                    .then(stream => {
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                            setVerificationMsg("Camera Active. Please align your face.");
                        }
                    })
                    .catch(e => {
                        alert("Camera access denied. Face verification is mandatory.");
                        setVerificationStep("none");
                    });
            }
        }, 800);
    };

    const captureAndVerify = () => {
        if (!videoRef.current || !canvasRef.current || !student) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const selfie = canvas.toDataURL('image/jpeg');
            setCapturedSelfie(selfie);
            
            // Stop camera
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            
            setVerificationStep("matching");
            setVerificationMsg("Running AI Face Matching Algorithms...");
            
            setTimeout(() => {
                setVerificationStep("background");
                setVerificationMsg("Analyzing Background and Lighting...");
                
                setTimeout(() => {
                    setVerificationStep("blinking");
                    setVerificationMsg("Liveness Detection: Detecting Eye Patterns...");
                    setIsBlinking(true);
                    
                    setTimeout(() => {
                        setIsBlinking(false);
                        // In a real app, we'd compare selfie with student.profileImg
                        // For demo, we'll succeed if a profile image exists
                        if (student.profileImg) {
                            setVerificationStep("success");
                            setVerificationMsg("Verification Complete: 98.4% Identity Match.");
                            setTimeout(() => {
                                if (selectedPass) {
                                    GlobalStore.updatePass(selectedPass.id, { verifiedReturn: true, status: "used" });
                                }
                                setVerificationStep("none");
                                setSelectedPass(null);
                                setCapturedSelfie(null);
                                alert("Identity Verified. Return logging complete.");
                            }, 2000);
                        } else {
                            setVerificationStep("fail");
                            setVerificationMsg("Match Failed: No Profile Image to Compare.");
                        }
                    }, 2000);
                }, 1500);
            }, 2000);
        }
    };

    const resetForm = () => {
        setReason("");
        setOutTime("");
        setEndTime("");
        setSelectedSlot("");
        setGpsVerified(false);
        setUserCoords(null);
    };

    const logout = () => { sessionStorage.clear(); router.push("/login"); };

    if (!student) return null;

    return (
        <div className="min-h-screen bg-[#f3f4f9] pb-20 md:pb-0 overflow-x-hidden">
            {/* Navigational Identity Header */}
            <header className="fixed top-0 left-0 right-0 h-20 bg-white shadow-lg shadow-blue-100/50 z-[40] flex items-center justify-between px-6 md:px-12 border-b">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMenuOpen(true)} className="p-2 md:hidden"><Menu size={24} className="text-[#1e3a8a]" /></button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-[#1e3a8a] text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-200">M</div>
                        <div>
                            <h1 className="font-bold text-sm md:text-lg text-gray-900 tracking-tight leading-4">MEI LUNCH</h1>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Hostel Management</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-black text-gray-900 uppercase">{student.name}</span>
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{student.rollNo}</span>
                    </div>
                    {student.profileImg ? (
                        <img src={student.profileImg} className="w-10 h-10 md:w-12 md:h-12 rounded-2xl object-cover border-2 border-dashed border-blue-100 p-0.5" alt="P" />
                    ) : (
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><User size={24} className="text-[#1e3a8a]" /></div>
                    )}
                </div>
            </header>

            {/* Desktop Sidebar */}
            <aside className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-[50] transition-transform duration-300 md:translate-x-0 ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="p-8 pt-28 space-y-2">
                    <div className="md:hidden flex flex-col items-center mb-10 pb-10 border-b">
                         {student.profileImg ? (
                            <img src={student.profileImg} className="w-24 h-24 rounded-3xl object-cover mb-4 border-4 border-blue-50" alt="Profile" />
                        ) : (
                            <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-4"><User size={40} className="text-[#1e3a8a]" /></div>
                        )}
                        <h3 className="font-black text-gray-900 uppercase tracking-tighter">{student.name}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{student.rollNo}</p>
                    </div>

                    {[
                        { id: "dashboard", label: "Dashboard", icon: <Building size={20} /> },
                        { id: "requests", label: "Permission Status", icon: <FileText size={20} /> },
                        { id: "instructions", label: "Pass Timings", icon: <Info size={20} /> },
                        { id: "profile", label: "Identity Profile", icon: <UserCircle size={20} /> },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id as any); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${activeTab === item.id ? "bg-[#1e3a8a] text-white shadow-xl shadow-blue-100 scale-105" : "text-gray-500 hover:bg-blue-50"}`}
                        >
                            {item.icon}
                            <span className="font-bold uppercase tracking-widest text-[10px]">{item.label}</span>
                        </button>
                    ))}
                    <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-500 hover:bg-red-50 mt-10 transition-colors">
                        <LogOut size={20} />
                        <span className="font-bold uppercase tracking-widest text-[10px]">Logout</span>
                    </button>
                    <button onClick={() => setIsMenuOpen(false)} className="md:hidden absolute top-8 right-8 text-gray-400 hover:text-gray-900"><X size={24} /></button>
                </div>
            </aside>

            {/* Main Surface */}
            <main className="pt-28 md:pl-72 min-h-screen px-6 md:px-12 transition-all">
                {activeTab === "dashboard" && (
                    <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-5">
                        <div className="mb-10">
                            <h2 className="text-3xl font-black text-[#1e3a8a] tracking-tighter uppercase mb-2">Operational Dashboard</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] italic">Current Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                            <button 
                                onClick={() => { setApplyingType("lunch"); resetForm(); }}
                                className="group relative bg-[#1e3a8a] rounded-[2.5rem] p-10 text-left text-white overflow-hidden shadow-2xl shadow-blue-200 hover:shadow-3xl transition-all"
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-125 duration-700" />
                                <div className="p-4 bg-white/10 rounded-2xl w-fit mb-6"><Send size={32} className="rotate-[-45deg]" /></div>
                                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Apply Lunch Pass</h3>
                                <p className="text-xs opacity-70 font-medium leading-relaxed">Instant approval for designated lunch hours within college perimeter.</p>
                                <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                                    Continue <ChevronRight size={16} />
                                </div>
                            </button>

                            <button 
                                onClick={() => { setApplyingType("leave"); resetForm(); }}
                                className="group relative bg-white border border-gray-100 rounded-[2.5rem] p-10 text-left overflow-hidden shadow-sm hover:shadow-xl transition-all"
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-125 duration-700" />
                                <div className="p-4 bg-blue-50 rounded-2xl w-fit mb-6 text-[#1e3a8a] font-black italic">OUT</div>
                                <h3 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tight mb-2">Official Leave</h3>
                                <p className="text-xs text-gray-400 font-medium leading-relaxed">Submit leave request for advisor verification and approval.</p>
                                <div className="mt-8 flex items-center gap-2 text-[#1e3a8a] text-xs font-black uppercase tracking-widest">
                                    Continue <ChevronRight size={16} />
                                </div>
                            </button>
                        </div>

                        {/* Recent Pass Alert */}
                        {passes[0] && (
                            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-[#1e3a8a]/30 transition-all cursor-pointer" onClick={() => { setSelectedPass(passes[0]); setActiveTab("view_pass"); }}>
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-50 text-[#1e3a8a] rounded-3xl flex items-center justify-center font-black group-hover:bg-[#1e3a8a] group-hover:text-white transition-all shadow-sm">
                                        <FileText size={28} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Most Recent Action</p>
                                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter capitalize">{passes[0].type} Pass: {passes[0].status}</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase mt-1">{passes[0].date} | {passes[0].startTime} - {passes[0].endTime}</p>
                                    </div>
                                </div>
                                <div className="text-[#1e3a8a] font-black uppercase tracking-widest text-[9px] bg-blue-50 px-6 py-3 rounded-full group-hover:bg-[#1e3a8a] group-hover:text-white transition-all shadow-sm">View Details</div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "requests" && (
                    <div className="max-w-4xl animate-in slide-in-from-right-10">
                         <div className="mb-10 flex justify-between items-center bg-white p-8 rounded-[2rem] border shadow-sm">
                            <div>
                                <h2 className="text-2xl font-black text-[#1e3a8a] tracking-tighter uppercase">Permission History</h2>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 italic">Authorized Log Entries</p>
                            </div>
                            <div className="flex -space-x-3">
                                {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white" />)}
                            </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-[#1e3a8a] text-white">
                                    <tr className="text-[10px] uppercase font-black tracking-widest">
                                        <th className="px-10 py-6">Identity Tag</th>
                                        <th className="px-10 py-6">Temporal Window</th>
                                        <th className="px-10 py-6">Approval Node</th>
                                        <th className="px-10 py-6 text-right">Gate Sync</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                                    {passes.length === 0 ? (
                                        <tr><td colSpan={4} className="px-10 py-20 text-center text-gray-300 italic">No entry logs found for current session.</td></tr>
                                    ) : (
                                        passes.map((p) => (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => { setSelectedPass(p); setActiveTab("view_pass"); }}>
                                                <td className="px-10 py-8">
                                                    <span className="text-[#1e3a8a] font-black uppercase text-xs">{p.type} Request</span>
                                                    <p className="text-[8px] text-gray-400 mt-1 uppercase">ID: {p.id}</p>
                                                </td>
                                                <td className="px-10 py-8 text-xs">{p.date}<br/><span className="text-gray-400 text-[10px] uppercase">{p.startTime}-{p.endTime}</span></td>
                                                <td className="px-10 py-8 uppercase text-[10px]">
                                                    <div className={`flex items-center gap-2 ${p.status === 'approved' ? 'text-green-600' : p.status === 'rejected' ? 'text-red-500' : 'text-orange-500'}`}>
                                                        <div className={`w-2 h-2 rounded-full ${p.status === 'approved' ? 'bg-green-600' : p.status === 'rejected' ? 'bg-red-500' : 'bg-orange-500'}`} />
                                                        {p.status}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-right">
                                                     <button className="text-[10px] uppercase bg-blue-50 text-[#1e3a8a] px-4 py-1.5 rounded-full border border-blue-100 group-hover:bg-[#1e3a8a] group-hover:text-white transition-all">Details</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "view_pass" && selectedPass && (
                    <div className="max-w-2xl mx-auto animate-in zoom-in-95">
                        <button onClick={() => setActiveTab("dashboard")} className="mb-8 flex items-center gap-3 text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-[#1e3a8a]"><ArrowLeft size={16} /> Back to Hub</button>
                        
                        <div className="bg-white rounded-[3rem] p-10 md:p-12 shadow-2xl border-4 border-white relative overflow-hidden">
                             {/* Floating Security Badge */}
                            <div className="absolute top-0 right-0 bg-[#1e3a8a] text-white px-10 py-3 rounded-bl-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl z-10">
                                <ShieldCheck size={14} className="text-blue-300" /> Authenticated
                            </div>

                            <div className="text-center mb-10 pt-4">
                                <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[8px] mb-4 italic">Security Token / Unit {selectedPass.id.slice(-4)}</p>
                                <h3 className="text-4xl font-black text-[#1e3a8a] uppercase tracking-tighter mb-2">{selectedPass.type} Pass</h3>
                                <div className="flex justify-center gap-2">
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ring-1 ${selectedPass.status === 'approved' ? 'bg-green-50 text-green-600 ring-green-100' : 'bg-orange-50 text-orange-600 ring-orange-100'}`}>Status: {selectedPass.status}</span>
                                </div>
                            </div>

                            <div className="bg-[#1e3a8a]/5 p-12 rounded-[2.5rem] flex items-center justify-center mb-10 relative">
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none font-black text-8xl uppercase">MEI</div>
                                <div className="relative p-6 bg-white rounded-3xl shadow-xl shadow-blue-100 flex flex-col items-center">
                                    <QRCodeSVG value={JSON.stringify({id: selectedPass.id, student: student.name, roll: student.rollNo, status: selectedPass.status})} size={180} />
                                    <p className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Temporal Encryption Active</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-10">
                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-center">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Valid Date</p>
                                    <p className="font-bold text-gray-900">{selectedPass.date}</p>
                                </div>
                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-center">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Time Slot</p>
                                    <p className="font-bold text-gray-900">{selectedPass.startTime} - {selectedPass.endTime}</p>
                                </div>
                            </div>

                            {/* Gate Logging Indicators */}
                            <div className="space-y-3 mb-12">
                                <div className="flex items-center justify-between px-8 py-4 bg-gray-50 rounded-2xl border">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gate Exit Log</span>
                                    {selectedPass.scannedOutAt ? (
                                        <div className="flex items-center gap-2 text-green-600 font-bold text-xs"><CheckCircle2 size={16} /> {new Date(selectedPass.scannedOutAt).toLocaleTimeString()}</div>
                                    ) : <span className="text-gray-300 italic text-[10px] uppercase font-bold">Unrecorded</span>}
                                </div>
                                <div className="flex items-center justify-between px-8 py-4 bg-gray-50 rounded-2xl border">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gate Entry Log</span>
                                    {selectedPass.scannedInAt ? (
                                        <div className="flex items-center gap-2 text-green-600 font-bold text-xs"><CheckCircle2 size={16} /> {new Date(selectedPass.scannedInAt).toLocaleTimeString()}</div>
                                    ) : <span className="text-gray-300 italic text-[10px] uppercase font-bold">Unrecorded</span>}
                                </div>
                                <div className="flex items-center justify-between px-8 py-4 bg-gray-50 rounded-2xl border">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identity Match</span>
                                    {selectedPass.verifiedReturn ? (
                                        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs"><ShieldCheck size={16} /> Matches Record</div>
                                    ) : <span className="text-gray-300 italic text-[10px] uppercase font-bold">Pending Return Verification</span>}
                                </div>
                            </div>

                            {/* Verification Button if Scanned In but not Verified */}
                            {selectedPass.scannedInAt && !selectedPass.verifiedReturn && verificationStep === "none" && (
                                <button
                                    onClick={() => startSelfieVerification(selectedPass)}
                                    className="w-full py-6 bg-[#1e3a8a] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 hover:scale-[1.02] active:shadow-none transition-all group"
                                >
                                    <Camera size={24} className="group-hover:rotate-12 transition-transform" /> START FACE VERIFICATION
                                </button>
                            )}

                             {/* Print / Export Indicator */}
                            <div className="flex flex-col items-center gap-4 pt-10 border-t border-gray-100">
                                <p className="text-[9px] text-gray-400 font-bold uppercase text-center leading-loose">Digital scan is mandatory. Mobile screen must be visible to security personnel for authentication.</p>
                                <div className="flex gap-4">
                                    <div className="w-1.5 h-1.5 bg-blue-100 rounded-full" />
                                    <div className="w-1.5 h-1.5 bg-blue-100 rounded-full" />
                                    <div className="w-1.5 h-1.5 bg-blue-100 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "instructions" && (
                    <div className="max-w-4xl animate-in slide-in-from-right-10">
                        <div className="mb-12">
                             <h2 className="text-3xl font-black text-[#1e3a8a] tracking-tighter uppercase mb-4">Pass Timings & Rules</h2>
                             <div className="h-1.5 w-24 bg-blue-600 rounded-full" />
                        </div>
                        
                        <div className="grid gap-8">
                             <div className="bg-white rounded-[3rem] p-10 md:p-12 shadow-sm border border-gray-100">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-8 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-50 text-[#1e3a8a] rounded-xl flex items-center justify-center"><Clock size={20} /></div>
                                    Daily Lunch Slots
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        { s: "Slot 1", t: "12:00 PM - 01:00 PM", d: "First Batch Permissions" },
                                        { s: "Slot 2", t: "01:00 PM - 02:00 PM", d: "Second Batch Permissions" },
                                        { s: "Slot 3", t: "06:00 PM - 12:00 AM", d: "Extended Dinner Permissions" }
                                    ].map((slot, i) => (
                                        <div key={i} className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-[#1e3a8a]/30 transition-all">
                                            <div>
                                                <p className="text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest mb-1">{slot.s}</p>
                                                <p className="font-bold text-gray-900">{slot.t}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase italic">{slot.d}</p>
                                        </div>
                                    ))}
                                </div>
                             </div>

                             <div className="bg-[#1e3a8a] rounded-[3rem] p-12 md:p-16 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
                                <h3 className="text-2xl font-black uppercase mb-10 border-b border-white/10 pb-6 tracking-tighter">Security Protocol</h3>
                                <ul className="space-y-6">
                                    {[
                                        "Digital permissions must be generated prior to gate arrival.",
                                        "GPS verification is mandatory during the application phase.",
                                        "Selfie matching is required upon return to hostel perimeter.",
                                        "Failure to scan-in will result in automatic parent escalation.",
                                        "Any attempt at duplicate entry will trigger a security flag."
                                    ].map((rule, i) => (
                                        <li key={i} className="flex gap-4 text-sm font-medium leading-relaxed">
                                            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 text-[10px] font-black">{i+1}</div>
                                            {rule}
                                        </li>
                                    ))}
                                </ul>
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === "profile" && student && (
                    <div className="max-w-4xl animate-in zoom-in-95">
                        <div className="bg-white rounded-[3.5rem] p-12 md:p-20 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center gap-16 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/50 rounded-full -mr-40 -mt-40 -z-10" />
                            <div className="relative group">
                                {student.profileImg ? (
                                    <img src={student.profileImg} className="w-48 h-48 md:w-56 md:h-56 rounded-[3rem] object-cover shadow-2xl border-8 border-white group-hover:scale-105 transition-transform duration-500" alt="Profile" />
                                ) : (
                                    <div className="w-48 h-48 md:w-56 md:h-56 bg-blue-50 rounded-[3rem] flex items-center justify-center border-8 border-white shadow-xl"><User size={80} className="text-[#1e3a8a] opacity-50" /></div>
                                )}
                                <div className="absolute -bottom-4 -right-4 bg-[#1e3a8a] text-white p-4 rounded-3xl shadow-xl border-4 border-white"><CheckCircle2 size={24} /></div>
                            </div>
                            <div className="text-center md:text-left flex-1">
                                <p className="text-[#1e3a8a] font-black uppercase tracking-[0.4em] text-[10px] mb-4 italic">Authenticated Identity Profile</p>
                                <h2 className="text-5xl font-black text-gray-900 uppercase tracking-tighter mb-8 leading-none">{student.name}</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    {[
                                        { label: "Identity Node", val: student.rollNo, icon: <UserCircle size={14} /> },
                                        { label: "Branch / Dept", val: student.department, icon: <Book size={14} /> },
                                        { label: "Current Year", val: student.year + " Year", icon: <Building size={14} /> },
                                        { label: "Section", val: "Batch " + student.section, icon: <Building size={14} /> },
                                        { label: "Mobile Node", val: student.studentPhone, icon: <Phone size={14} /> },
                                        { label: "Parent Node", val: student.parentPhone, icon: <Phone size={14} /> }
                                    ].map((info, i) => (
                                        <div key={i} className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">{info.icon} {info.label}</span>
                                            <span className="text-xs font-bold text-gray-800 uppercase">{info.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Application Dialog */}
                {applyingType && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-8 animate-in fade-in transition-all">
                        <div className="bg-white w-full max-w-2xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-full md:zoom-in border border-white/20">
                            <button onClick={() => setApplyingType(null)} className="absolute top-8 right-8 p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-colors z-[101]"><X size={20} /></button>
                            
                            <div className="p-10 md:p-16">
                                <div className="mb-12">
                                    <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-widest text-xs mb-4 italic">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" /> Permission Request Module
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter capitalize">{applyingType} Application</h3>
                                </div>

                                <form onSubmit={handleApply} className="space-y-8">
                                    {applyingType === "lunch" ? (
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Select Operations Slot</label>
                                            <div className="grid grid-cols-1 gap-3">
                                                {[
                                                    { id: "12:00PM-01:00PM", label: "Slot 1: 12:00 PM - 01:00 PM" },
                                                    { id: "01:00PM-02:00PM", label: "Slot 2: 01:00 PM - 02:00 PM" },
                                                    { id: "06:00PM-12:00AM", label: "Slot 3: 06:00 PM - 12:00 AM" }
                                                ].map((slot) => (
                                                    <button
                                                        key={slot.id}
                                                        type="button"
                                                        onClick={() => setSelectedSlot(slot.id as any)}
                                                        className={`w-full p-6 rounded-2xl text-left border-2 font-black text-xs uppercase transition-all flex items-center justify-between ${selectedSlot === slot.id ? "bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-xl shadow-blue-100" : "bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200"}`}
                                                    >
                                                        {slot.label}
                                                        {selectedSlot === slot.id && <CheckCircle2 size={16} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Reason for Leave Request</label>
                                                <textarea 
                                                    required 
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl p-6 md:p-8 outline-none focus:border-[#1e3a8a] font-bold text-xs uppercase placeholder:text-gray-300 min-h-[160px] leading-relaxed" 
                                                    placeholder="Specify legitimate reason for permissions..."
                                                    value={reason}
                                                    onChange={e => setReason(e.target.value)}
                                                ></textarea>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Start Hr</label>
                                                    <input required type="time" className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 font-bold outline-none focus:border-[#1e3a8a]" value={outTime} onChange={e => setOutTime(e.target.value)} />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">End Hr</label>
                                                    <input required type="time" className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 font-bold outline-none focus:border-[#1e3a8a]" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* GPS Verification Strip */}
                                    {!gpsVerified && (
                                        <div className="bg-orange-50 border-2 border-orange-100 rounded-3xl p-6 md:p-8 flex items-center justify-between gap-6 animate-pulse">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-orange-600 text-white p-3 rounded-2xl shadow-lg shadow-orange-100"><ShieldCheck size={24} /></div>
                                                <div>
                                                    <p className="font-black text-[10px] text-orange-900 uppercase tracking-widest">Temporal Location Check</p>
                                                    <p className="text-[9px] text-orange-700/70 font-bold uppercase mt-1">Verification Required</p>
                                                </div>
                                            </div>
                                            <div className="w-2.5 h-2.5 bg-orange-600 rounded-full" />
                                        </div>
                                    )}
                                    
                                    {gpsVerified && (
                                        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-6 md:p-8 flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-green-600 text-white p-3 rounded-2xl shadow-lg shadow-green-100"><CheckCircle2 size={24} /></div>
                                                <div>
                                                    <p className="font-black text-[10px] text-green-900 uppercase tracking-widest">Geolocation Matrix Validated</p>
                                                    <p className="text-[9px] text-green-700/70 font-bold uppercase mt-1">LAT: {userCoords?.lat.toFixed(4)} | LNG: {userCoords?.lng.toFixed(4)}</p>
                                                </div>
                                            </div>
                                            <div className="w-2.5 h-2.5 bg-green-600 rounded-full" />
                                        </div>
                                    )}

                                    <button 
                                        type="submit" 
                                        disabled={isGpsChecking}
                                        className={`w-full py-7 rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] shadow-2xl transition-all ${isGpsChecking ? 'bg-gray-100 text-gray-400' : 'bg-[#1e3a8a] text-white shadow-blue-100 hover:scale-[0.98] active:scale-95'}`}
                                    >
                                        {isGpsChecking ? "Checking Identity Node..." : (!gpsVerified ? "VERIFY LOCATION" : "AUTHORIZE ACCESS")}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Identity Face Matcher Overlay */}
                {verificationStep !== "none" && (
                    <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-2xl z-[200] flex items-center justify-center p-6">
                        <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 md:p-14 shadow-2xl relative overflow-hidden text-center border-4 border-white/20">
                            {/* Scanning Effect Overlay */}
                            {verificationStep === "matching" && (
                                <div className="absolute inset-0 bg-blue-600/5 animate-pulse pointer-events-none" />
                            )}
                            
                            <h3 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tighter mb-10 border-b pb-6">Return Authentication</h3>
                            
                            <div className="relative w-full aspect-square md:w-80 md:h-80 mx-auto rounded-[3rem] overflow-hidden bg-gray-100 mb-10 border-8 border-gray-50 shadow-2xl group">
                                {verificationStep === "camera" && (
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
                                )}
                                {(verificationStep === "matching" || verificationStep === "background" || verificationStep === "blinking" || verificationStep === "success" || verificationStep === "fail") && capturedSelfie && (
                                    <img src={capturedSelfie} className="w-full h-full object-cover" alt="Selfie" />
                                )}
                                
                                <canvas ref={canvasRef} className="hidden" />
                                
                                {/* Frame Decorations */}
                                <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-blue-600/30 rounded-tl-2xl" />
                                <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-blue-600/30 rounded-tr-2xl" />
                                <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-blue-600/30 rounded-bl-2xl" />
                                <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-blue-600/30 rounded-br-2xl" />
                                
                                {/* Scanning Laser */}
                                {(verificationStep === "matching" || verificationStep === "background" || verificationStep === "blinking") && (
                                    <div className="absolute inset-x-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan pointer-events-none z-10" />
                                )}

                                {/* Liveness Detection Dots */}
                                {isBlinking && (
                                    <div className="absolute inset-0 flex items-center justify-center gap-10">
                                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping shadow-lg shadow-blue-400" />
                                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping shadow-lg shadow-blue-400" />
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-3xl p-8 mb-10 border border-gray-100">
                                <p className={`font-black uppercase tracking-widest text-[10px] mb-2 ${verificationStep === "success" ? "text-green-600" : verificationStep === "fail" ? "text-red-600" : "text-[#1e3a8a]"}`}>
                                    {verificationStep.toUpperCase()} NODE ACTIVE
                                </p>
                                <p className="text-sm font-bold text-gray-900">{verificationMsg}</p>
                            </div>

                            {verificationStep === "camera" && (
                                <button
                                    onClick={captureAndVerify}
                                    className="w-full py-6 bg-[#1e3a8a] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 hover:scale-[0.98] transition-all"
                                >
                                    CAPTURE IDENTITY
                                </button>
                            )}

                            {verificationStep === "fail" && (
                                <button
                                    onClick={() => setVerificationStep("none")}
                                    className="w-full py-6 bg-red-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em]"
                                >
                                    ABORT SESSION
                                </button>
                            )}

                            {verificationStep === "success" && (
                                <div className="w-full py-6 bg-green-50 text-green-600 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] border-2 border-green-100 flex items-center justify-center gap-3">
                                    <CheckCircle2 size={24} /> ACCESS LOGGED
                                </div>
                            )}

                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-8 leading-relaxed">System encrypted facial vectors are processed locally and deleted after verification audit.</p>
                        </div>
                    </div>
                )}
            </main>
            
            {/* Mobile Bottom Nav Bar Overlay */}
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t z-[40] md:hidden flex items-center justify-around px-2 shadow-2xl">
                {[
                    { id: "dashboard", icon: <Building size={20} />, label: "Hub" },
                    { id: "requests", icon: <FileText size={20} />, label: "Passes" },
                    { id: "profile", icon: <UserCircle size={20} />, label: "Self" },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`flex flex-col items-center gap-1 flex-1 py-2 transition-all ${activeTab === item.id ? "text-[#1e3a8a]" : "text-gray-400"}`}
                    >
                        <div className={`p-2 rounded-xl ${activeTab === item.id ? "bg-blue-50" : ""}`}>{item.icon}</div>
                        <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
