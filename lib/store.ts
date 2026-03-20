"use client";

import { databases, APPWRITE_CONFIG } from "./appwrite";
import { ID, Query } from "appwrite";

// Simple singleton store for managing app state locally with localStorage persistence.

export type PassType = "lunch" | "leave";
export type PassStatus = "pending" | "approved" | "rejected" | "used" | "expired";
export type UserRole = "student" | "admin" | "advisor" | "watchman";

// Configuration for Notification Delays (in minutes after pass end time)
export const NOTIFY_DELAY_STUDENT = 1; 
export const NOTIFY_DELAY_ADVISOR = 6;
export const NOTIFY_CHECK_INTERVAL = 30000; // 30 seconds

export interface User {
    id: string;
    username: string;
    password: string;
    role: UserRole;
    name: string;
    email: string; // Added email field
    profileImg?: string;
}

export interface Student extends User {
    rollNo: string;
    department: string;
    year: string;
    section: string;
    parentPhone: string;
    studentPhone: string;
}

export interface Advisor extends User {
    department: string;
    assignedClass: string; // e.g., "CSE-3-A" (Dept-Year-Sec)
    phone: string;
}

export interface Pass {
    id: string;
    studentId: string;
    type: PassType;
    status: PassStatus;
    appliedAt: string;
    date: string; // User requested date
    startTime?: string; // User requested time
    endTime?: string;
    reason?: string; // For leave passes
    approvedAt?: string;
    scannedOutAt?: string;
    scannedInAt?: string;
    // Expiry message tracking
    studentNotified?: boolean;
    advisorNotified?: boolean;
    parentNotified?: boolean;
    lat?: number;
    lng?: number;
    verifiedReturn?: boolean;
}

class PassStore {
    private users: User[] = [
        { id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin", email: "admin@mei.hostel" },
        { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)", email: "watch1@mei.hostel" },
        { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)", email: "watch2@mei.hostel" },
        { id: "demo_student", username: "student", password: "123", role: "student", name: "Test Student", email: "student@mei.hostel", rollNo: "MAH001", department: "B.Tech IT", year: "3", section: "A", parentPhone: "9876543210", studentPhone: "8877665544" } as Student
    ];
    private passes: Pass[] = [];
    private listeners: (() => void)[] = [];

    constructor() {
        if (typeof window !== "undefined") {
            const savedPasses = localStorage.getItem("mei_passes");
            const savedUsers = localStorage.getItem("mei_users");
            
            if (savedPasses) {
                this.passes = JSON.parse(savedPasses);
            } else {
                this.passes = [];
            }

            if (savedUsers) {
                const parsedUsers = JSON.parse(savedUsers);
                // Ensure default users always exist and are merged correctly
                const defaultUsers = [
                    { id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin", email: "admin@mei.hostel" },
                    { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)", email: "watch1@mei.hostel" },
                    { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)", email: "watch2@mei.hostel" },
                    { id: "demo_student", username: "student", password: "123", role: "student", name: "Test Student", email: "student@mei.hostel", rollNo: "MAH001", department: "B.Tech IT", year: "3", section: "A", parentPhone: "9876543210", studentPhone: "8877665544" } as Student
                ];
                
                const filteredParsed = parsedUsers.filter((u: User) => 
                    !defaultUsers.some(d => d.id === u.id || d.username === u.username)
                );

                this.users = [...defaultUsers, ...filteredParsed];
            }
            
            // Sync across tabs
            window.addEventListener('storage', (e) => {
                if (e.key === 'mei_passes' && e.newValue) {
                    this.passes = JSON.parse(e.newValue);
                    this.notify();
                }
                if (e.key === 'mei_users' && e.newValue) {
                    const parsedUsers = JSON.parse(e.newValue);
                    const defaultUsers = [
                        { id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin" },
                        { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)" },
                        { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)" },
                        { id: "demo_student", username: "student", password: "123", role: "student", name: "Test Student" }
                    ];
                    const filteredParsed = parsedUsers.filter((u: User) => 
                        !defaultUsers.some(d => d.id === u.id || d.username === u.username)
                    );
                    this.users = [...defaultUsers, ...filteredParsed] as User[];
                    this.notify();
                }
            });

            // Auto-check expiries every 30 seconds
            setInterval(() => this.checkExpiries(), NOTIFY_CHECK_INTERVAL);

            // Initial Cloud Sync
            this.syncWithCloud();
        }
    }

    private async syncWithCloud() {
        if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) return;
        
        try {
            console.log("Syncing with Appwrite Cloud...");
            
            // Sync Users
            const userDocs = await databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.usersCollectionId
            );
            
            if (userDocs.documents.length > 0) {
                const cloudUsers = userDocs.documents.map(doc => {
                    const { $id, $createdAt, $updatedAt, $permissions, $databaseId, $collectionId, ...data } = doc;
                    return { ...data, id: $id } as unknown as User;
                });
                
                const defaultUsers = [
                    { id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin" },
                    { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)" },
                    { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)" },
                    { id: "demo_student", username: "student", password: "123", role: "student", name: "Test Student" }
                ];

                const localOnly = this.users.filter(u => !defaultUsers.some(d => d.id === u.id) && !cloudUsers.some(c => c.id === u.id));
                this.users = [...defaultUsers, ...cloudUsers, ...localOnly] as User[];
                
                // If we have local-only users, push them to cloud
                for (const u of localOnly) {
                    await this.pushUserToCloud(u);
                }
            }

            // Sync Passes
            const passDocs = await databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.passesCollectionId,
                [Query.limit(100), Query.orderDesc("$createdAt")]
            );

            if (passDocs.documents.length > 0) {
                const cloudPasses = passDocs.documents.map(doc => {
                    const { $id, $createdAt, $updatedAt, $permissions, $databaseId, $collectionId, ...data } = doc;
                    return { ...data, id: $id } as unknown as Pass;
                });

                const localOnly = this.passes.filter(p => !cloudPasses.some(c => c.id === p.id));
                this.passes = [...cloudPasses, ...localOnly].sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

                for (const p of localOnly) {
                    await this.pushPassToCloud(p);
                }
            }

            this.save();
            this.notify();
            console.log("Cloud Sync Complete.");
        } catch (error) {
            console.error("Cloud sync failed:", error);
        }
    }

    private async pushUserToCloud(user: User) {
        if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || user.id.startsWith('admin') || user.id.startsWith('watchman') || user.id === 'demo_student') return;
        try {
            await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.usersCollectionId,
                user.id,
                user
            );
        } catch (e: any) {
            if (e.code === 409) {
                await databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.usersCollectionId,
                    user.id,
                    user
                );
            }
        }
    }

    private async pushPassToCloud(pass: Pass) {
        if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) return;
        try {
            await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.passesCollectionId,
                pass.id,
                pass
            );
        } catch (e: any) {
            if (e.code === 409) {
                await databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.passesCollectionId,
                    pass.id,
                    pass
                );
            }
        }
    }

    private checkExpiries() {
        if (typeof window === "undefined") return;
        
        const now = new Date();
        let changed = false;

        this.passes = this.passes.map(pass => {
            if (pass.type !== "lunch" || pass.status !== "approved" || !pass.endTime) return pass;

            // Simple time parser (HH:MM)
            const [endH, endM] = pass.endTime.split(":").map(Number);
            const endTimeDate = new Date();
            endTimeDate.setHours(endH, endM, 0);

            const diffMins = (now.getTime() - endTimeDate.getTime()) / (1000 * 60);

            let updatedPass = { ...pass };

            // Student msg
            if (diffMins >= NOTIFY_DELAY_STUDENT && !pass.studentNotified) {
                const student = this.users.find(u => u.id === pass.studentId) as Student;
                if (student) {
                    this.simulateSMS(student.id, `LUNCH PASS EXPIRED! You were supposed to return by ${pass.endTime}. Return to hostel immediately.`, student.studentPhone);
                    updatedPass.studentNotified = true;
                    changed = true;
                }
            }

            // Advisor msg
            if (diffMins >= NOTIFY_DELAY_ADVISOR && !pass.advisorNotified) {
                const student = this.users.find(u => u.id === pass.studentId) as Student;
                const advisors = this.users.filter(u => u.role === "advisor") as Advisor[];
                const studentClass = `${student?.department}-${student?.year}-${student?.section}`.toUpperCase();
                const advisor = advisors.find(a => a.assignedClass.toUpperCase() === studentClass);

                if (advisor && student) {
                    this.simulateSMS(advisor.id, `ALERT: Student ${student.name} (${student.rollNo}) has not returned from Lunch (End: ${pass.endTime}). Action required.`, advisor.phone);
                    
                    // Send Email to Advisor
                    fetch("/api/send-advisor-mail", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: 'overdue',
                            studentName: student.name,
                            studentId: student.id,
                            studentRoll: student.rollNo,
                            studentClass: `${student.department} ${student.year}-${student.section}`,
                            advisorEmail: advisor.email || (advisor.username.includes('@') ? (advisor.email || advisor.username) : "mcram2008@gmail.com"),
                            passDetails: {
                                id: pass.id,
                                type: pass.type,
                                endTime: pass.endTime,
                                scannedOutAt: pass.scannedOutAt,
                            }
                        }),
                    }).catch(err => console.error("Advisor Email failed:", err));

                    updatedPass.advisorNotified = true;
                    changed = true;
                }
            }

            return updatedPass;
        });

        if (changed) {
            this.save();
            this.notify();
        }
    }

    private save() {
        if (typeof window !== "undefined") {
            localStorage.setItem("mei_passes", JSON.stringify(this.passes));
            localStorage.setItem("mei_users", JSON.stringify(this.users.filter(u => u.id !== "admin1" && u.id !== "watchman_common")));
        }
    }

    getUsers() { return this.users; }
    getPasses() { return this.passes; }

    addUser(user: User) {
        this.users.push(user);
        this.save();
        this.notify();
        this.pushUserToCloud(user);
        
        // Notify user about registration
        let phone = "";
        if (user.role === "student") phone = (user as Student).studentPhone;
        else if (user.role === "advisor") phone = (user as Advisor).phone;
        
        if (phone) {
            this.simulateSMS(user.id, `Welcome to MEI Hostel Portal. Account active!`, phone);
        }
    }

    updateUser(id: string, updates: Partial<User>) {
        this.users = this.users.map(u => u.id === id ? { ...u, ...updates } : u);
        this.save();
        this.notify();
        const updated = this.users.find(u => u.id === id);
        if (updated) this.pushUserToCloud(updated);
    }

    deleteUser(id: string) {
        const user = this.users.find(u => u.id === id);
        this.users = this.users.filter(u => u.id !== id);
        this.save();
        this.notify();
        if (user && process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
            databases.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.usersCollectionId, id)
                .catch(e => console.error("Cloud delete failed:", e));
        }
    }

    addPass(pass: Pass) {
        // Check for duplicate pass on the same day
        const existingPass = this.passes.find(p => p.studentId === pass.studentId && p.date === pass.date && p.status !== 'rejected');
        
        if (existingPass) {
            const student = this.users.find(u => u.id === pass.studentId) as Student;
            const advisors = this.users.filter(u => u.role === "advisor") as Advisor[];
            const studentClass = `${student?.department}-${student?.year}-${student?.section}`.toUpperCase();
            const advisor = advisors.find(a => a.assignedClass.toUpperCase() === studentClass);

            if (student) {
                // Send Duplicate Alert Email
                fetch("/api/send-advisor-mail", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: 'duplicate',
                        studentName: student.name,
                        studentRoll: student.rollNo,
                        studentClass: `${student.department} ${student.year}-${student.section}`,
                        advisorEmail: advisor?.email || advisor?.username?.includes('@') ? (advisor?.email || advisor?.username) : "mcram2008@gmail.com",
                        passDetails: {
                            date: pass.date,
                            existingPass: {
                                type: existingPass.type,
                                startTime: existingPass.startTime,
                                endTime: existingPass.endTime
                            },
                            newPass: {
                                type: pass.type,
                                startTime: pass.startTime,
                                endTime: pass.endTime
                            }
                        }
                    }),
                }).catch(err => console.error("Duplicate pass email failed:", err));
            }
        }

        this.passes.push(pass);
        this.save();
        this.notify();
        this.pushPassToCloud(pass);
        
        const student = this.users.find(u => u.id === pass.studentId) as Student;
        // Only lunch pass messages as per request (aside from application confirmation maybe)
        if (student && pass.type === 'lunch') {
            this.simulateSMS(pass.studentId, `Lunch Pass applied for ${pass.date} (${pass.startTime}-${pass.endTime})`, student.parentPhone);
        }
    }

    updatePass(id: string, updates: Partial<Pass>) {
        this.passes = this.passes.map(p => p.id === id ? { ...p, ...updates } : p);
        this.save();
        this.notify();

        const pass = this.passes.find(p => p.id === id);
        if (pass) this.pushPassToCloud(pass);
        if (pass && updates.status === "approved" && pass.type === 'lunch') {
            const student = this.users.find(u => u.id === pass.studentId) as Student;
            if (student) {
                this.simulateSMS(pass.studentId, `Lunch Pass APPROVED for ${pass.date}. Ready for exit.`, student.studentPhone);
            }
        }
    }

    public sendCustomSMS(userId: string, targetPhone: string, message: string) {
        this.simulateSMS(userId, message, targetPhone);
    }

    private simulateSMS(userId: string, message: string, overridePhone?: string) {
        const user = this.users.find(u => u.id === userId);
        if (user || overridePhone) {
            let phone = overridePhone;
            if (!phone && user) {
                if (user.role === "student") phone = (user as Student).studentPhone;
                else if (user.role === "advisor") phone = (user as Advisor).phone;
            }
            
            if (!phone) return;

            if (typeof window !== "undefined") {
                const toast = document.createElement("div");
                toast.className = "fixed bottom-6 right-6 w-[340px] bg-gray-900 text-white rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-bottom-12 p-6 border border-white/10";
                toast.innerHTML = `
                    <p class="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">System Notification</p>
                    <p class="text-xs font-bold leading-relaxed italic">"${message}"</p>
                `;
                document.body.appendChild(toast);

                setTimeout(() => {
                    toast.classList.add("animate-out", "fade-out", "slide-out-to-bottom-12");
                    setTimeout(() => toast.remove(), 500);
                }, 5000);
            }
        }
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    // Maintenance method to reset history
    public resetHistory() {
        this.passes = [];
        if (typeof window !== "undefined") {
            localStorage.removeItem("mei_passes");
        }
        this.notify();
    }
}

export const GlobalStore = new PassStore();
export const MOCK_STUDENTS = () => GlobalStore.getUsers().filter(u => u.role === "student") as Student[];
export const MOCK_ADVISORS = () => GlobalStore.getUsers().filter(u => u.role === "advisor") as Advisor[];
