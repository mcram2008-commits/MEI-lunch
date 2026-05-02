"use client";

import { useState, useEffect } from "react";
import { GlobalStore, User, Student } from "@/lib/store";
import { useRouter } from "next/navigation";
import { User as UserIcon, Lock, Phone, ShieldCheck, Smartphone } from "lucide-react";

export default function SimpleLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loginStep, setLoginStep] = useState<"credentials" | "advisor_approval">("credentials");
    const [tempUser, setTempUser] = useState<User | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    const router = useRouter();

    useEffect(() => {
        // If already logged in, redirect them
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
            const u = JSON.parse(savedUser);
            completeLogin(u);
        }
    }, []);

    const handleInitialLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        setTimeout(() => {
            const user = GlobalStore.getUsers().find(u => u.username === username && u.password === password);

            if (user) {
                if (user.role === "student") {
                    const student = user as Student;
                    if (student.loginApproved) {
                        completeLogin(student);
                    } else {
                        if (!student.loginRequested) {
                            GlobalStore.updateUser(student.id, { loginRequested: true } as any);
                        }
                        setTempUser(student);
                        setLoginStep("advisor_approval");
                        setIsLoading(false);
                    }
                } else {
                    completeLogin(user);
                }
            } else {
                setError("Invalid Username or Password");
                setIsLoading(false);
            }
        }, 1000);
    };

    const handleRefreshStatus = () => {
        if (!tempUser) return;
        const updatedUser = GlobalStore.getUsers().find(u => u.id === tempUser.id) as Student;
        if (updatedUser?.loginApproved) {
            completeLogin(updatedUser);
        } else {
            setError("Still waiting for advisor approval...");
        }
    };

    const completeLogin = (user: User) => {
        localStorage.setItem("user", JSON.stringify(user));
        if (user.role === "admin") router.push("/admin");
        else if (user.role === "advisor") router.push("/advisor");
        else if (user.role === "watchman") router.push("/watchman");
        else router.push("/student");
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header Banner Like Images */}
            <div className="h-48 bg-gradient-to-r from-[#1e3a8a] to-[#5b21b6] flex items-center justify-center">
                <div className="text-white text-center">
                    <h1 className="text-3xl font-bold tracking-tight">MEI Lunch</h1>
                    <p className="text-sm opacity-80 mt-1 uppercase tracking-widest">Login Portal</p>
                </div>
            </div>

            <div className="max-w-md mx-auto p-8 -mt-8 bg-white rounded-t-3xl shadow-2xl relative z-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-8 border-b pb-4">
                    {loginStep === "credentials" ? "Sign In" : "Advisor Approval"}
                </h2>

                {error && (
                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 italic">
                        {error}
                    </div>
                )}

                {loginStep === "credentials" ? (
                    <form onSubmit={handleInitialLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="text"
                                    className="w-full h-14 pl-12 pr-4 bg-gray-50 border-none rounded-xl font-bold text-gray-700 focus:bg-white focus:ring-2 ring-blue-100 outline-none transition-all"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="password"
                                    className="w-full h-14 pl-12 pr-4 bg-gray-50 border-none rounded-xl font-bold text-gray-700 focus:bg-white focus:ring-2 ring-blue-100 outline-none transition-all"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            disabled={isLoading}
                            className="w-full h-14 bg-[#1e3a8a] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-transform active:scale-95 disabled:opacity-50 mt-4 uppercase tracking-widest shadow-blue-200"
                        >
                            {isLoading ? "Validating..." : "Login"}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-6 text-center py-6">
                        <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <ShieldCheck size={40} />
                        </div>
                        <h3 className="font-black text-[#1e3a8a] text-xl uppercase tracking-tight">Pending Approval</h3>
                        <p className="text-xs text-gray-500 font-bold px-4 leading-relaxed">
                            Your login request has been sent to your Class Advisor. Please wait for them to approve your login request before proceeding.
                        </p>
                        
                        <div className="pt-4 flex flex-col gap-3">
                            <button
                                onClick={handleRefreshStatus}
                                className="w-full h-14 bg-[#1e3a8a] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-transform active:scale-95 uppercase tracking-widest shadow-blue-200"
                            >
                                Refresh Status
                            </button>
                            <button
                                onClick={() => {
                                    setLoginStep("credentials");
                                    setError("");
                                }}
                                className="w-full h-14 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:shadow-lg transition-transform active:scale-95 uppercase tracking-widest"
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-12 text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">
                    © MEI INSTITUTIONS 2026
                </div>
            </div>
        </div>
    );
}
