"use client";

import { useState, useEffect } from "react";
import { GlobalStore, Pass, MOCK_STUDENTS } from "@/lib/store";
import { Bell, AlertTriangle, ShieldCheck, User, Users, Smartphone } from "lucide-react";

export default function AlertSimulation() {
    const [now, setNow] = useState<string>("01:55 PM");
    const [alerts, setAlerts] = useState<any[]>([]);
    const [notReturnedStudents, setNotReturnedStudents] = useState<any[]>([]);

    const times = ["02:00 PM", "02:05 PM", "02:10 PM", "02:15 PM"];

    useEffect(() => {
        const update = () => {
            const late = GlobalStore.getPasses().filter(p => p.type === "lunch" && p.scannedOutAt && !p.scannedInAt);
            setNotReturnedStudents(late.map(p => ({
                ...p,
                student: MOCK_STUDENTS().find(s => s.id === p.studentId)
            })));
        };
        update();
        return GlobalStore.subscribe(update);
    }, []);

    const triggerTime = (time: string) => {
        setNow(time);
        if (notReturnedStudents.length === 0) return;

        let newAlerts = [...alerts];
        notReturnedStudents.forEach(p => {
            if (time === "02:05 PM") {
                newAlerts.push({ id: Date.now() + 1, time, to: "Student", message: `Hey ${p.student.name}, it's 2:05 PM. You are late! Please return immediately.`, type: 'student' });
            }
            if (time === "02:10 PM") {
                newAlerts.push({ id: Date.now() + 2, time, to: "Advisor", message: `Alert: Student ${p.student.name} (${p.student.rollNo}) has not returned from lunch as of 2:10 PM.`, type: 'advisor' });
            }
            if (time === "02:15 PM") {
                newAlerts.push({ id: Date.now() + 3, time, to: "Parents", message: `Urgent: Your ward ${p.student.name} has not checked back into the college after lunch (2:15 PM).`, type: 'parent' });
            }
        });
        setAlerts(newAlerts);
    };

    return (
        <div className="fixed bottom-6 right-6 w-96 z-50">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[600px]">
                <div className="p-6 bg-red-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={20} />
                        <h2 className="font-bold">Alert Simulator</h2>
                    </div>
                    <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded">SYSTEM STATUS: LATE CHECK</span>
                </div>

                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500">SET SYSTEM TIME:</span>
                    <div className="flex gap-1">
                        {times.map(t => (
                            <button
                                key={t}
                                onClick={() => triggerTime(t)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${now === t ? "bg-red-600 text-white shadow-md scale-110" : "bg-white text-gray-400 hover:text-gray-600"
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {alerts.length === 0 ? (
                        <div className="py-12 text-center text-gray-300">
                            <ShieldCheck size={48} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No alerts triggered yet</p>
                        </div>
                    ) : (
                        alerts.slice().reverse().map(alert => (
                            <div key={alert.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${alert.type === 'student' ? 'bg-blue-100 text-blue-600' :
                                                alert.type === 'advisor' ? 'bg-green-100 text-green-600' :
                                                    'bg-orange-100 text-orange-600'
                                            }`}>
                                            {alert.type === 'student' ? <Smartphone size={14} /> :
                                                alert.type === 'advisor' ? <User size={14} /> : <Users size={14} />}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-gray-400">TO {alert.to}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-300">{alert.time}</span>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed font-medium capitalize-first">
                                    {alert.message}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {notReturnedStudents.length > 0 && (
                    <div className="p-4 bg-red-50 border-t border-red-100">
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <AlertTriangle size={16} />
                            <span className="text-xs font-bold uppercase">Target: {notReturnedStudents.length} Students Late</span>
                        </div>
                        <div className="flex -space-x-2">
                            {notReturnedStudents.map(p => (
                                <div key={p.id} className="w-8 h-8 rounded-full bg-red-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-red-700">
                                    {p.student.name.charAt(0)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
