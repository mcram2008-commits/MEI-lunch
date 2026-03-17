"use client";

// Simple singleton store for managing app state locally with localStorage persistence.

export type PassType = "lunch" | "leave";
export type PassStatus = "pending" | "approved" | "rejected" | "used" | "expired";
export type UserRole = "student" | "admin" | "advisor" | "watchman";

export interface User {
    id: string;
    username: string;
    password: string;
    role: UserRole;
    name: string;
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
        { id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin" },
        { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)" },
        { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)" },
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
                // Ensure default users exist
                this.users = [{ id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin" },
                    { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)" },
                    { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)" },
                    ...parsedUsers.filter((u: User) => u.id !== "admin1" && u.id !== "watchman_common")];
            }
            
            // Sync across tabs
            window.addEventListener('storage', (e) => {
                if (e.key === 'mei_passes' && e.newValue) {
                    this.passes = JSON.parse(e.newValue);
                    this.notify();
                }
                if (e.key === 'mei_users' && e.newValue) {
                    const parsedUsers = JSON.parse(e.newValue);
                    this.users = [{ id: "admin1", username: "admin", password: "123", role: "admin", name: "System Admin" },
                    { id: "watchman1", username: "watchman1", password: "123", role: "watchman", name: "Watchman 1 (Entry Control)" },
                    { id: "watchman2", username: "watchman2", password: "123", role: "watchman", name: "Watchman 2 (Exit Control)" },
                    ...parsedUsers.filter((u: User) => u.id !== "admin1" && u.id !== "watchman_common")];
                    this.notify();
                }
            });

            // Auto-check expiries every 30 seconds
            setInterval(() => this.checkExpiries(), 30000);
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

            // 1 min after: Student msg
            if (diffMins >= 1 && !pass.studentNotified) {
                const student = this.users.find(u => u.id === pass.studentId) as Student;
                if (student) {
                    this.simulateEmail(student.id, `LUNCH PASS EXPIRED! You were supposed to return by ${pass.endTime}. Return to hostel immediately.`);
                    updatedPass.studentNotified = true;
                    changed = true;
                }
            }

            // 5 mins after (total 6): Advisor msg
            if (diffMins >= 6 && !pass.advisorNotified) {
                const student = this.users.find(u => u.id === pass.studentId) as Student;
                const advisors = this.users.filter(u => u.role === "advisor") as Advisor[];
                const studentClass = `${student?.department}-${student?.year}-${student?.section}`.toUpperCase();
                const advisor = advisors.find(a => a.assignedClass.toUpperCase() === studentClass);

                if (advisor && student) {
                    this.simulateEmail(advisor.id, `ALERT: Student ${student.name} (${student.rollNo}) has not returned from Lunch (End: ${pass.endTime}). Action required.`);
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
        
        // Notify user about registration
        let identification = user.username;
        
        if (identification) {
            this.simulateEmail(user.id, `Welcome to MEI Hostel Portal. Account active!`);
        }
    }

    updateUser(id: string, updates: Partial<User>) {
        this.users = this.users.map(u => u.id === id ? { ...u, ...updates } : u);
        this.save();
        this.notify();
    }

    deleteUser(id: string) {
        this.users = this.users.filter(u => u.id !== id);
        this.save();
        this.notify();
    }

    addPass(pass: Pass) {
        this.passes.push(pass);
        this.save();
        this.notify();
        
        const student = this.users.find(u => u.id === pass.studentId) as Student;
        // Only lunch pass messages as per request (aside from application confirmation maybe)
        if (student && pass.type === 'lunch') {
            this.simulateEmail(pass.studentId, `Lunch Pass applied for ${pass.date} (${pass.startTime}-${pass.endTime})`);
        }
    }

    updatePass(id: string, updates: Partial<Pass>) {
        this.passes = this.passes.map(p => p.id === id ? { ...p, ...updates } : p);
        this.save();
        this.notify();

        const pass = this.passes.find(p => p.id === id);
        if (pass && updates.status === "approved" && pass.type === 'lunch') {
            const student = this.users.find(u => u.id === pass.studentId) as Student;
            if (student) {
                this.simulateEmail(pass.studentId, `Lunch Pass APPROVED for ${pass.date}. Ready for exit.`);
            }
        }
    }

    public sendCustomEmail(userId: string, targetEmail: string, message: string) {
        this.simulateEmail(userId, message, targetEmail);
    }

    private simulateEmail(userId: string, message: string, overrideEmail?: string) {
        const user = this.users.find(u => u.id === userId);
        if (user || overrideEmail) {
            let email = overrideEmail;
            if (!email && user) {
                email = `${user.username}@college.edu`;
            }
            
            if (!email) return;

            if (typeof window !== "undefined") {
                const toast = document.createElement("div");
                toast.className = "fixed bottom-6 right-6 w-[340px] bg-blue-900 text-white rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-bottom-12 p-6 border border-white/20";
                toast.innerHTML = `
                    <p class="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">Email Sent To: ${email}</p>
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
