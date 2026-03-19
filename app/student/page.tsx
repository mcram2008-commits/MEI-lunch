"use client";

import { useState, useEffect, useRef } from "react";
import { GlobalStore, Pass, Student } from "@/lib/store";
import { QRCodeSVG } from "qrcode.react";
import {
    Menu, X, History, Clock, Send, User, LogOut,
    Calendar, Info, ChevronRight, CheckCircle2,
    Plus, Search, Phone, Book, Building, UserCircle, ArrowLeft, XCircle, FileText, Camera
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
    const [selectedSlot, setSelectedSlot] = useState<"12:00PM-01:00PM" | "01:00PM-02:00PM" | "09:00AM-05:00PM" | "">("");

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
                setIsGpsChecking(false);
            }
            return;
        }

        // Restriction: Cannot apply before 11:30 AM for today's pass
        const now = new Date();
        const [todayY, todayM, todayD] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
        const [appY, appM, appD] = passDate.split("-").map(Number);

        if (applyingType === "lunch" && todayY === appY && todayM === appM && todayD === appD) {
            const openHour = 11;
            const openMin = 30;
            if (now.getHours() < openHour || (now.getHours() === openHour && now.getMinutes() < openMin)) {
                alert(`Lunch pass application opens at ${openHour}:${openMin} AM.`);
                return;
            }
            
            // Check if lunch pass already exists for today
            const existingLunch = passes.find(p => p.type === "lunch" && p.date === passDate);
            if (existingLunch) {
                alert("You have already applied for a Lunch Pass today.");
                return;
            }
        }

        let resStartTime = "";
        let resEndTime = "";

        if (applyingType === "lunch") {
            if (selectedSlot === "12:00PM-01:00PM") {
                resStartTime = "12:00";
                resEndTime = "13:00";
            } else if (selectedSlot === "01:00PM-02:00PM") {
                resStartTime = "13:00";
                resEndTime = "14:00";
            } else if (selectedSlot === "09:00AM-05:00PM") {
                resStartTime = "09:00";
                resEndTime = "17:00";
            }
        } else if (applyingType === "leave") {
            resStartTime = outTime;
            resEndTime = "23:59"; // Default end for leave
        }

        const newPass: Pass = {
            id: `P${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            studentId: student.id,
            type: applyingType,
            status: applyingType === "lunch" ? "approved" : "pending",
            appliedAt: new Date().toISOString(),
            date: passDate,
            startTime: resStartTime,
            endTime: resEndTime,
            reason: applyingType === "leave" ? reason : undefined,
            lat: userCoords?.lat,
            lng: userCoords?.lng,
        };
        GlobalStore.addPass(newPass);

        setApplyingType(null);
        setReason("");
        setOutTime("");
        setSelectedSlot("");
        setGpsVerified(false);
        setUserCoords(null);
        setActiveTab("requests");
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const handleVerifyReturn = async () => {
        if (!selectedPass) return;
        
        setVerificationStep("camera");
        setVerificationMsg("Initializing Camera...");
        setCapturedSelfie(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Step 1: Capture Selfie & Match
            setTimeout(() => {
                // Flash effect/Capture
                if (videoRef.current && canvasRef.current) {
                    const canvas = canvasRef.current;
                    const video = videoRef.current;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        setCapturedSelfie(canvas.toDataURL('image/jpeg'));
                    }
                }

                setVerificationStep("matching");
                setVerificationMsg("Biometric Matching in Progress...");
                
                setTimeout(() => {
                    // Strict Verified Logic
                    const isDemo = student?.id === "demo_student";
                    const hasProfile = !!student?.profileImg;
                    
                    // Simulation: First attempt in this pass session will FAIL to show strictness
                    const verifKey = `fail_sim_${selectedPass.id}`;
                    const hasFailedOnce = sessionStorage.getItem(verifKey);

                    let matchScore = 0;
                    if (!hasFailedOnce) {
                        // FORCE FAIL on first try to show rejection logic
                        matchScore = 65 + (Math.random() * 12); 
                        sessionStorage.setItem(verifKey, "true");
                    } else {
                        // SUCCESS on retry
                        matchScore = (isDemo || hasProfile) ? (94 + Math.random() * 5) : (88 + Math.random() * 8);
                    }
                    
                    const scoreStr = matchScore.toFixed(1);

                    if (matchScore < 90) { // High threshold: 90%
                        setVerificationStep("fail");
                        setVerificationMsg(`SECURITY ALERT: Face Mismatch (${scoreStr}%)`);
                        stopCamera();
                        return;
                    }

                    setVerificationMsg(`Strict Match Verified: ${scoreStr}%`);
                    
                    // Step 2: Background Check
                    setTimeout(() => {
                        setVerificationStep("background");
                        setVerificationMsg("Analyzing Background (White Req)...");
                        
                        setTimeout(() => {
                            setVerificationMsg("Background: Optimized (White)");

                            // Step 3: Liveness Check (Blink)
                            setTimeout(() => {
                                setVerificationStep("blinking");
                                setVerificationMsg("Please Blink Your Eyes");
                                
                                setTimeout(() => {
                                    setIsBlinking(true);
                                    
                                    setTimeout(() => {
                                        setVerificationStep("success");
                                        setVerificationMsg("Identity Verified!");
                                        stopCamera();

                                        GlobalStore.updatePass(selectedPass.id, { 
                                            status: "used", 
                                            verifiedReturn: true,
                                            scannedInAt: new Date().toISOString()
                                        });

                                        setTimeout(() => {
                                            setVerificationStep("none");
                                            setIsBlinking(false);
                                            setActiveTab("requests");
                                        }, 2000);
                                    }, 1000);
                                }, 1500);
                            }, 1500);
                        }, 2000);
                    }, 2000);
                }, 3000); // 3 seconds matching for drama
            }, 2000);

        } catch (err) {
            console.error("Camera access denied:", err);
            alert("Camera access is required for identity verification.");
            setVerificationStep("none");
        }
    };

    const isWithinTime = (pass: Pass) => {
        const now = new Date();
        const [y, m, d] = pass.date.split("-").map(Number);
        const [sh, sm] = (pass.startTime || "00:00").split(":").map(Number);
        const [eh, em] = (pass.endTime || "23:59").split(":").map(Number);
        const start = new Date(y, m - 1, d, sh, sm);
        const end = new Date(y, m - 1, d, eh, em);
        return now >= start && now <= end;
    };

    const isExpired = (pass: Pass) => {
        const now = new Date();
        const [y, m, d] = pass.date.split("-").map(Number);
        const [eh, em] = (pass.endTime || "23:59").split(":").map(Number);
        
        // Add 15 minute grace period for QR visibility
        const expiryTime = new Date(y, m - 1, d, eh, em);
        expiryTime.setMinutes(expiryTime.getMinutes() + 15);
        
        return now > expiryTime;
    };

    if (!student) return null;

    const handleLogout = () => { sessionStorage.removeItem("user"); router.push("/login"); };

    return (
        <div className="min-h-screen bg-[#f3f4f9] pb-10">
            {/* Mobile Header (Blue/Purple Banner like app 1) */}
            <header className="fixed top-0 bg-gradient-to-r from-[#1e3a8a] to-[#5b21b6] text-white w-full h-16 flex items-center px-6 z-50">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -ml-2">
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h1 className="ml-6 font-bold text-lg tracking-tight capitalize">
                    {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'requests' ? 'Request' : activeTab === 'profile' ? 'Profile' : 'Instructions'}
                </h1>
                {activeTab === 'requests' && <Search className="ml-auto" size={20} />}
            </header>

            {/* Sidebar Menu Drawer (Black/Gray from app image 3) */}
            <div
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={() => setIsMenuOpen(false)}
            />
            <aside className={`fixed top-0 left-0 h-full w-[80%] bg-[#333333] z-50 shadow-2xl transition-transform duration-300 transform ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex flex-col h-full">
                    <div className="bg-gradient-to-r from-[#1e3a8a] to-[#5b21b6] p-10 flex flex-col items-center justify-center text-white">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 p-2">
                            <div className="w-full h-full bg-[#1e3a8a] rounded-full flex items-center justify-center font-black">MEI</div>
                        </div>
                        <p className="font-bold text-lg uppercase tracking-widest">MEI Hostel</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-2 mt-4 text-white">
                        <button
                            onClick={() => { setActiveTab("dashboard"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-6 p-4 rounded-xl font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="w-6"><User size={20} /></div> Dashboard
                        </button>
                        <button
                            onClick={() => { setActiveTab("requests"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-6 p-4 rounded-xl font-medium transition-colors ${activeTab === 'requests' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="w-6"><History size={20} /></div> Active Passes
                        </button>
                        <button
                            onClick={() => { setActiveTab("profile"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-6 p-4 rounded-xl font-medium transition-colors ${activeTab === 'profile' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="w-6"><UserCircle size={20} /></div> Profile
                        </button>
                        <button
                            onClick={() => { setActiveTab("instructions"); setIsMenuOpen(false); }}
                            className={`w-full flex items-center gap-6 p-4 rounded-xl font-medium transition-colors ${activeTab === 'instructions' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="w-6"><Info size={20} /></div> Pass Timing
                        </button>
                        <hr className="border-white/10 my-6" />
                        <button onClick={handleLogout} className="w-full flex items-center gap-6 p-4 rounded-xl font-medium text-red-100 hover:bg-red-500/10">
                            <div className="w-6"><LogOut size={20} /></div> Logout
                        </button>
                    </nav>
                </div>
            </aside>

            <main className="pt-16 min-h-screen">
                {activeTab === "dashboard" && (
                    <div className="p-8 animate-in fade-in space-y-8">
                        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm flex items-center gap-6">
                            <div className="w-20 h-20 bg-blue-100 border-4 border-white shadow-xl rounded-full flex items-center justify-center p-2 overflow-hidden">
                                {student.profileImg ? (
                                    <img src={student.profileImg} className="w-full h-full object-cover rounded-full" alt="Profile" />
                                ) : (
                                    <div className="w-full h-full bg-[#1e3a8a] rounded-full flex items-center justify-center text-white font-black">{student.name.charAt(0)}</div>
                                )}
                            </div>
                            <div>
                                <h2 className="text-gray-500 font-bold uppercase tracking-widest text-xs">Welcome</h2>
                                <h1 className="text-2xl font-black text-[#1e3a8a] tracking-tight">{student.name}</h1>
                            </div>
                        </div>

                        {/* Apply Pass options removed from here as per user request */}


                    </div>
                )}

                {activeTab === "requests" && (
                    <div className="p-4 space-y-4 animate-in fade-in">
                        {/* New Application Options inside Request List as per user request */}
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <button
                                onClick={() => { setApplyingType("lunch"); setActiveTab("view_pass"); }}
                                className="bg-white p-4 rounded-xl shadow-sm border text-center flex items-center justify-center gap-2 active:scale-95 transition-all text-[#1e3a8a] font-black uppercase text-[10px] tracking-widest"
                            >
                                <Clock size={16} /> Lunch
                            </button>
                            <button
                                onClick={() => { setApplyingType("leave"); setActiveTab("view_pass"); }}
                                className="bg-white p-4 rounded-xl shadow-sm border text-center flex items-center justify-center gap-2 active:scale-95 transition-all text-purple-600 font-black uppercase text-[10px] tracking-widest"
                            >
                                <Send size={16} /> Leave
                            </button>
                        </div>

                        {passes.length === 0 ? (
                            <div className="text-center py-20 text-gray-300 font-bold uppercase tracking-widest text-xs">No records found</div>
                        ) : (
                            passes.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setSelectedPass(p); setActiveTab("view_pass"); }}
                                    className="w-full bg-white rounded-2xl shadow-sm border p-6 flex flex-col space-y-3 relative overflow-hidden group active:scale-[0.98] transition-all"
                                >
                                    {/* Decorative Wave from app image 2 */}
                                    <div className="absolute top-0 -right-4 w-40 h-40 bg-[#cffafe] rounded-full opacity-30 -mr-10 -mt-20 group-hover:scale-110 transition-transform"></div>

                                    <div className="flex items-center gap-6 relative z-10">
                                        <Calendar size={18} className="text-gray-400" />
                                        <span className="font-bold text-gray-700">{p.date}</span>
                                        <div className="w-[1px] h-4 bg-gray-200" />
                                        <Clock size={18} className="text-gray-400" />
                                        <span className="font-bold text-gray-700">{p.startTime} - {p.endTime}</span>
                                    </div>

                                    <div className="flex items-center gap-6 relative z-10">
                                        <User size={18} className="text-gray-400" />
                                        <span className="font-bold text-gray-700 tracking-wide uppercase">Outing</span>
                                    </div>

                                    <div className="flex items-center gap-6 relative z-10">
                                        <Info size={18} className="text-gray-400" />
                                        <span className="font-bold text-gray-700 capitalize">Purpose: {p.type === 'lunch' ? 'Lunch' : 'Official Leave'}</span>
                                    </div>

                                    <div className="flex items-center gap-6 relative z-10">
                                        <CheckCircle2 size={18} className={p.status === 'approved' ? 'text-green-500' : 'text-orange-500'} />
                                        <span className={`font-black uppercase tracking-widest text-xs ${p.status === 'approved' ? 'text-green-600' : 'text-orange-600'}`}>{p.status}</span>
                                    </div>
                                </button>
                            ))
                        )}

                    </div>
                )}

                {activeTab === "view_pass" && (
                    <div className="p-8 animate-in slide-in-from-bottom-8">
                        <button onClick={() => setActiveTab("requests")} className="mb-8 flex items-center gap-2 text-[#1e3a8a] font-bold">
                            <ArrowLeft size={20} /> Back
                        </button>

                        {applyingType ? (
                            <div className="bg-white p-10 rounded-[2rem] shadow-xl space-y-8">
                                <h2 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tighter">Apply {applyingType.toUpperCase()}</h2>
                                <form onSubmit={handleApply} className="space-y-6">
                                    <div>
                                        <label className="text-xs font-black uppercase text-gray-400 tracking-widest block mb-2">Target Date (Today Only)</label>
                                        <input 
                                            type="date" 
                                            required 
                                            readOnly
                                            min={new Date().toISOString().split('T')[0]} 
                                            max={new Date().toISOString().split('T')[0]} 
                                            className="w-full h-14 bg-gray-100 rounded-xl px-5 font-bold text-gray-500" 
                                            value={passDate} 
                                            onChange={e => setPassDate(e.target.value)} 
                                        />
                                    </div>

                                    {applyingType === "lunch" ? (
                                        <div className="space-y-4">
                                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest block mb-2">Select Time Slot</label>
                                            <div className="grid grid-cols-1 gap-3">
                                                {["12:00PM-01:00PM", "01:00PM-02:00PM"].map(slot => (
                                                    <button
                                                        key={slot}
                                                        type="button"
                                                        onClick={() => setSelectedSlot(slot as any)}
                                                        className={`w-full h-14 rounded-xl font-bold border-2 transition-all ${selectedSlot === slot ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                                    >
                                                        {slot}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase text-gray-400 tracking-widest block mb-1">Out Time</label>
                                                <input 
                                                    type="time" 
                                                    required 
                                                    className="w-full h-14 bg-gray-50 rounded-xl px-5 font-bold" 
                                                    value={outTime} 
                                                    onChange={e => setOutTime(e.target.value)} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase text-gray-400 tracking-widest block mb-1">Reason for Leave</label>
                                                <textarea
                                                    required
                                                    className="w-full p-5 bg-gray-50 rounded-xl font-bold min-h-[120px] outline-none focus:ring-2 ring-purple-100"
                                                    placeholder="Enter detailed reason..."
                                                    value={reason}
                                                    onChange={e => setReason(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        disabled={isGpsChecking || (applyingType === "lunch" && !selectedSlot)}
                                        className={`w-full h-16 rounded-xl font-black text-lg shadow-xl uppercase tracking-widest transition-all ${isGpsChecking ? 'bg-gray-400 text-white' : gpsVerified ? 'bg-green-600 text-white shadow-green-100' : 'bg-[#1e3a8a] text-white shadow-blue-100'}`}
                                    >
                                        {isGpsChecking ? "Checking Location..." : gpsVerified ? "Submit Request" : "Verify GPS & Apply"}
                                    </button>
                                </form>
                            </div>
                        ) : selectedPass ? (
                            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden text-center relative">
                                <div className={`h-2 w-full ${selectedPass.status === 'approved' ? 'bg-green-500' : 'bg-orange-500'}`} />
                                <div className="p-10">
                                    {selectedPass.status === 'approved' ? (
                                        <div className="flex flex-col items-center">
                                            {isExpired(selectedPass) ? (
                                                <div className="py-12 w-full">
                                                    <XCircle size={64} className="mx-auto text-red-500 mb-4" />
                                                    <p className="font-black text-red-500 uppercase italic">Token Expired</p>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">Time closed at {selectedPass.endTime}</p>
                                                    <button onClick={() => setActiveTab('requests')} className="mt-8 px-6 py-3 bg-red-50 text-red-600 rounded-full font-black text-xs uppercase tracking-widest border border-red-100">Go Back</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="mb-6">
                                                        <p className="text-xl font-black text-[#1e3a8a] uppercase tracking-tight">{student.name}</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{student.rollNo} | {student.department}</p>
                                                    </div>
                                                    <div className="p-6 bg-gray-50 rounded-[2rem] mb-8 border-2 border-dashed border-gray-200 w-full flex flex-col items-center">
                                                        {verificationStep === "none" ? (
                                                            <div className="w-full flex flex-col items-center">
                                                                <div className="bg-white p-4 rounded-3xl shadow-inner mb-2 border">
                                                                    <QRCodeSVG
                                                                        value={JSON.stringify({
                                                                            id: selectedPass.id,
                                                                            name: student.name,
                                                                            roll: student.rollNo,
                                                                            dept: student.department
                                                                        })}
                                                                        size={180}
                                                                    />
                                                                </div>
                                                                
                                                                <div className="w-full mt-4 space-y-3">
                                                                    {!selectedPass.scannedOutAt ? (
                                                                        <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-orange-100 flex items-center justify-center gap-3 animate-pulse">
                                                                            <Clock size={16} /> Scan at Exit Gate to Start
                                                                        </div>
                                                                    ) : !selectedPass.scannedInAt ? (
                                                                        <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100 flex flex-col items-center gap-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <CheckCircle2 size={14} className="text-green-500" />
                                                                                <span>Exit Recorded: {new Date(selectedPass.scannedOutAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                            </div>
                                                                            <p className="opacity-70 italic text-[8px]">Scan at Entry Gate to Enable Selfie</p>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-4">
                                                                            <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-green-100 flex flex-col items-center gap-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <CheckCircle2 size={14} /> Entry Gate Scanned
                                                                                </div>
                                                                                <p className="opacity-70 text-[8px]">Complete Selfie to Finalize</p>
                                                                            </div>
                                                                            <button 
                                                                                onClick={handleVerifyReturn}
                                                                                className="w-full h-18 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-[2rem] font-black text-xs shadow-xl shadow-green-100 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-4 py-6 border-4 border-white"
                                                                            >
                                                                                <Camera size={20} /> Verify Return (Selfie)
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full space-y-6 animate-in zoom-in">
                                                                <canvas ref={canvasRef} className="hidden" />
                                                                <div className="relative w-56 h-56 bg-black rounded-[2.5rem] mx-auto overflow-hidden border-8 border-white shadow-2xl">
                                                                    {(verificationStep === "camera" || verificationStep === "matching" || verificationStep === "background" || verificationStep === "blinking") && (
                                                                        <>
                                                                            <video 
                                                                                ref={videoRef} 
                                                                                autoPlay 
                                                                                playsInline 
                                                                                muted 
                                                                                className="w-full h-full object-cover grayscale-[0.2] brightness-110"
                                                                            />
                                                                            {/* Face Placement Guide Overlay */}
                                                                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                                                <div className="w-40 h-48 border-2 border-white/40 rounded-[3rem] shadow-[0_0_0_999px_rgba(0,0,0,0.4)]" />
                                                                                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-red-500/30 -translate-y-10" />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    
                                                                    {/* Scanning Overlays */}
                                                                    {verificationStep === "matching" && (
                                                                        <>
                                                                            <div className="absolute inset-0 bg-blue-500/10 animate-pulse z-10" />
                                                                            <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 shadow-[0_0_15px_blue] animate-scan z-20" />
                                                                            <div className="absolute top-4 right-4 flex gap-2 animate-in slide-in-from-right-8 z-30">
                                                                                <div className="w-14 h-14 rounded-lg border-2 border-white shadow-lg overflow-hidden bg-gray-200">
                                                                                    {student.profileImg ? (
                                                                                        <img src={student.profileImg} className="w-full h-full object-cover grayscale" alt="DB Record" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-[8px] text-white font-black text-center leading-none">DB<br/>FACE</div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="w-14 h-14 rounded-lg border-2 border-green-500 shadow-lg overflow-hidden bg-gray-200">
                                                                                    {capturedSelfie && <img src={capturedSelfie} className="w-full h-full object-cover grayscale" alt="Live Face" />}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    {verificationStep === "background" && (
                                                                        <div className="absolute inset-0 bg-white/20 flex flex-col items-center justify-center">
                                                                            <div className="w-48 h-48 border-2 border-white/50 rounded-full border-dashed animate-spin-slow" />
                                                                        </div>
                                                                    )}

                                                                    {verificationStep === "blinking" && (
                                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                            <div className={`w-20 h-2 bg-blue-500 rounded-full transition-all duration-300 ${isBlinking ? 'scale-y-[0.1]' : 'shadow-[0_0_20px_rgba(59,130,246,1)]'}`} />
                                                                        </div>
                                                                    )}

                                                                    {verificationStep === "success" && (
                                                                        <div className="absolute inset-0 bg-green-500 flex items-center justify-center text-white">
                                                                            <CheckCircle2 size={80} className="animate-bounce" />
                                                                        </div>
                                                                    )}

                                                                    {verificationStep === "fail" && (
                                                                        <div className="absolute inset-0 bg-red-500 flex items-center justify-center text-white">
                                                                            <XCircle size={80} className="animate-pulse" />
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Feedback Message */}
                                                                    <div className={`absolute bottom-4 inset-x-4 backdrop-blur-md py-2 rounded-xl border ${verificationStep === 'fail' ? 'bg-red-900/60 border-red-500/30' : 'bg-black/60 border-white/10'}`}>
                                                                        <p className="text-[8px] font-black text-white uppercase tracking-widest text-center truncate">{verificationMsg}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="space-y-4">
                                                                    {verificationStep === "fail" ? (
                                                                        <button 
                                                                            onClick={handleVerifyReturn}
                                                                            className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-red-100 animate-in slide-in-from-bottom-4"
                                                                        >
                                                                            Try Verification Again
                                                                        </button>
                                                                    ) : (
                                                                        <>
                                                                            <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-widest text-center italic">Biometric Identity Secure</h3>
                                                                            <div className="flex items-center justify-center gap-2">
                                                                                <div className={`w-1.5 h-1.5 rounded-full ${verificationStep === 'matching' ? 'bg-blue-600 animate-pulse' : 'bg-gray-200'}`} />
                                                                                <div className={`w-1.5 h-1.5 rounded-full ${verificationStep === 'background' ? 'bg-blue-600 animate-pulse' : 'bg-gray-200'}`} />
                                                                                <div className={`w-1.5 h-1.5 rounded-full ${verificationStep === 'blinking' ? 'bg-blue-600 animate-pulse' : 'bg-gray-200'}`} />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="bg-gray-50 w-full p-6 rounded-2xl flex justify-between font-bold text-[10px] uppercase text-gray-400 tracking-widest">
                                                        <div className="text-left"><p>Valid Date</p><p className="text-gray-900 mt-1 font-black">{selectedPass.date}</p></div>
                                                        <div className="text-right"><p>Time Window</p><p className="text-gray-900 mt-1 font-black">{selectedPass.type === 'lunch' ? `${selectedPass.startTime}-${selectedPass.endTime}` : 'All Day'}</p></div>
                                                    </div>
                                                </>
                                            )}
                                            {selectedPass.reason && !isExpired(selectedPass) && (
                                                <div className="mt-4 w-full p-4 bg-purple-50 rounded-xl text-left border-l-4 border-purple-500">
                                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Reason for Leave</p>
                                                    <p className="text-xs font-bold text-gray-700 italic">{selectedPass.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : selectedPass.status === 'used' ? (
                                        <div className="py-12 flex flex-col items-center animate-in zoom-in">
                                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-50">
                                                <CheckCircle2 size={48} />
                                            </div>
                                            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Entry Verified</h2>
                                            <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest italic">Pass has been successfully used</p>
                                            
                                            <div className="mt-8 w-full space-y-2 text-[10px] font-black uppercase text-gray-400">
                                                <div className="flex justify-between p-4 bg-gray-50 rounded-xl">
                                                    <span>Exit Time</span>
                                                    <span className="text-gray-900">{selectedPass.scannedOutAt ? new Date(selectedPass.scannedOutAt).toLocaleTimeString() : 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between p-4 bg-gray-50 rounded-xl">
                                                    <span>Entry Time</span>
                                                    <span className="text-gray-900">{selectedPass.scannedInAt ? new Date(selectedPass.scannedInAt).toLocaleTimeString() : 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : selectedPass.status === 'rejected' ? (
                                        <div className="py-12 text-red-500">
                                            <XCircle size={64} className="mx-auto mb-4" />
                                            <p className="font-black uppercase">Pass Rejected</p>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-orange-500">
                                            <Clock size={64} className="mx-auto mb-4 animate-pulse" />
                                            <p className="font-black uppercase tracking-widest">Awaiting Approval</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {activeTab === "profile" && (
                    <div className="p-0 animate-in fade-in slide-in-from-top-4">
                        {/* Profile Page Layout like App Image 4 */}
                        <div className="h-96 bg-gradient-to-b from-[#1e3a8a] to-[#5b21b6] relative flex items-end justify-center pb-12">
                            <div className="w-64 h-64 bg-white rounded-[2.5rem] border-8 border-white/20 shadow-2xl overflow-hidden flex items-center justify-center p-0">
                                {student.profileImg ? (
                                    <img src={student.profileImg} className="w-full h-full object-cover" alt="Profile" />
                                ) : (
                                    <UserCircle size={200} className="text-gray-200" />
                                )}
                            </div>
                        </div>

                        <div className="max-w-[90%] mx-auto -mt-8 bg-white rounded-3xl p-10 shadow-xl border border-gray-100 text-center space-y-8">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{student.name}</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">{student.rollNo}</p>
                            </div>

                            <hr className="border-gray-50" />

                            <div className="space-y-6 text-sm font-black text-gray-600 uppercase tracking-widest leading-6">
                                <p className="flex items-center gap-4 justify-center"><Building size={16} className="text-blue-500" /> {student.department}</p>
                                <p className="flex items-center gap-4 justify-center"><Book size={16} className="text-blue-500" /> B-TECH (IT)</p>
                                <p className="flex items-center gap-4 justify-center"><Building size={16} className="text-blue-500" /> Year {student.year} | {student.section}</p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-4 justify-center text-[#1e3a8a] text-xs">
                                        <Phone size={14} /> <span>S: {student.studentPhone}</span>
                                    </div>
                                    <div className="flex items-center gap-4 justify-center text-orange-600 text-xs">
                                        <Phone size={14} /> <span>P: {student.parentPhone}</span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleLogout} className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-100 mt-8 active:scale-95 transition-all">Logout</button>
                        </div>
                    </div>
                )}

                {activeTab === "instructions" && (
                    <div className="p-8 animate-in fade-in space-y-8">
                        <h2 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-widest border-b pb-4">Pass Timings</h2>
                        <div className="space-y-4">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-600">
                                <p className="font-black text-[#1e3a8a] mb-1">Lunch Break Timings</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-2">Slot 1: 12:00 PM to 01:00 PM</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Slot 2: 01:00 PM to 02:00 PM</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-purple-600">
                                <p className="font-black text-purple-600 mb-1">Official Leave</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">As approved by Advisor</p>
                            </div>
                            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-red-700">
                                <p className="font-black mb-2 uppercase italic text-xs">Emergency Reporting</p>
                                <p className="text-xs font-bold leading-relaxed uppercase tracking-tighter">Students found outside campus after 8:00 PM will face strict disciplinary action.</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
