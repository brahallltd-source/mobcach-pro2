"use client";
import { useState, useEffect } from "react";

export default function AgentsManagement() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. دالة جلب الوكلاء من السيرفر
  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/agents"); // هاد الـ API خاصو يكون واجد
      const data = await res.json();
      setAgents(data);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // 2. دالة تعديل الرصيد يدوياً
  const handleUpdateBalance = async (agentId: string, newAmount: string) => {
    const res = await fetch(`/api/admin/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_balance", amount: newAmount }),
    });
    if (res.ok) fetchAgents();
  };

  // 3. دالة تعطيل/تفعيل الحساب
  const handleToggleStatus = async (agentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/admin/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status: nextStatus }),
    });
    if (res.ok) fetchAgents();
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-4">
          إدارة الوكلاء 💰
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
              <tr>
                <th className="py-3 px-6 text-left">المعلومات الشخصية</th>
                <th className="py-3 px-6 text-center">الرصيد الحالي</th>
                <th className="py-3 px-6 text-center">حالة الحساب</th>
                <th className="py-3 px-6 text-center">التحكم</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-light">
              {agents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400">لا يوجد وكلاء حالياً</td>
                </tr>
              )}
              {agents.map((agent: any) => (
                <tr key={agent.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-6 text-left whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700">{agent.user?.username}</span>
                      <span className="text-xs text-gray-400">{agent.user?.email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-center font-mono font-bold text-blue-600 text-lg">
                    ${agent.availableBalance?.toFixed(2)}
                  </td>
                  <td className="py-3 px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      agent.user?.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {agent.user?.status === 'ACTIVE' ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-center flex justify-center gap-3">
                    <button 
                      onClick={() => {
                        const amt = prompt("أدخل مبلغ الرصيد الجديد:", agent.availableBalance);
                        if (amt !== null) handleUpdateBalance(agent.id, amt);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition duration-200"
                    >
                      تعديل الرصيد
                    </button>
                    <button 
                      onClick={() => handleToggleStatus(agent.id, agent.user?.status)}
                      className={`${
                        agent.user?.status === 'ACTIVE' 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-emerald-500 hover:bg-emerald-600'
                      } text-white px-4 py-2 rounded-lg transition duration-200`}
                    >
                      {agent.user?.status === 'ACTIVE' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}