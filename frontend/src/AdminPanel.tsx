import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, CreditCard, Activity, Trash2, XCircle, Calendar, UserPlus
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const ADMIN_API = 'http://localhost:3005/api/admin';

interface User {
  phone: string;
  name?: string;
  email?: string;
  cpf?: string;
  status: string;
  plan: string;
  expiry?: string;
}

interface Stats {
  totalUsers: number;
  activeSubs: number;
  globalVolume: number;
  conversionRate: number;
}

function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [subProjection, setSubProjection] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeSubs: 0, globalVolume: 0, conversionRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const [usersRes, statsRes, projectionRes] = await Promise.all([
        axios.get(`${ADMIN_API}/users`, config),
        axios.get(`${ADMIN_API}/stats`, config),
        axios.get(`${ADMIN_API}/subs-projection`, config)
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setSubProjection(projectionRes.data);
    } catch (error) {
      console.error("Admin Access Denied or Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (phone: string, status: string, plan: string = 'free') => {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    await axios.patch(`${ADMIN_API}/users/${phone}/status`, { status, plan }, config);
    fetchAdminData();
  };

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);

  const handleUpdateExpiry = (phone: string, current: string) => {
    setSelectedPhone(phone);
    setNewDate(current ? current.split('T')[0] : '');
    setShowModal(true);
  };

  const submitNewExpiry = async () => {
    if (newDate) {
      await axios.patch(`${ADMIN_API}/users/${selectedPhone}/expiry`, { expiry: newDate });
      setShowModal(false);
      fetchAdminData();
    }
  };

  const handleCancelSub = async (phone: string) => {
    if (window.confirm("Deseja CANCELAR a assinatura? O sistema calculará a multa automática.")) {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${ADMIN_API}/users/${phone}/cancel`, {}, config);
      alert(`${res.data.message}\nMulta de quebra de contrato: R$ ${res.data.cancellationFine}\n${res.data.details}`);
      fetchAdminData();
    }
  };

  const handleDelete = async (phone: string) => {
    if (window.confirm("LGPD: Isto excluirá PERMANENTEMENTE todos os dados do cliente (Gastos, Receitas e Perfil). Prosseguir?")) {
      const token = localStorage.getItem('token');
      await axios.delete(`${ADMIN_API}/users/${phone}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchAdminData();
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser({ ...user });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.patch(`${ADMIN_API}/users/${editingUser.phone}`, editingUser, { headers: { Authorization: `Bearer ${token}` } });
      setShowEditModal(false);
      fetchAdminData();
      alert('Usuário atualizado com sucesso!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao atualizar');
    }
  };

  const handleAdminResetPassword = async (phone: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post(`${ADMIN_API}/users/${phone}/reset-password`, {}, { headers: { Authorization: `Bearer ${token}` } });
      alert(`TOKEN GERADO: ${res.data.token}\n\nEnvie este código ao cliente. Ele deve usar na tela de login.`);
    } catch (err) {
      alert('Erro ao gerar token');
    }
  };

  const handleResetAll = async () => {
    if (window.confirm("⚠️ ATENÇÃO: Isto resetará TODOS os usuários para o plano FREE e resetará as expirações. A projeção de faturamento ficará ZERADA. Confirmar?")) {
      const token = localStorage.getItem('token');
      try {
        await axios.post(`${ADMIN_API}/wipe-data-projection?t=${Date.now()}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        fetchAdminData();
        alert('Dados resetados! A projeção deve estar vazia (Zero) agora.');
      } catch (err) {
        alert('Erro ao processar o reset. Se o erro 404 persistir, o servidor Docker ainda está recarregando.');
      }
    }
  };

  return (
    <div className="admin-container dashboard-content">
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-premium anim-slide-up">
            <h3 className="mb-16">Atualizar Expiração</h3>
            <p className="dim mb-24">Defina a nova data de vencimento para o WhatsApp {selectedPhone}</p>
            <div className="input-field mb-32">
              <label className="dim fs-12 mb-4 block">Nova Data</label>
              <input 
                type="date" 
                className="w-full bg-slate p-12 rounded"
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-12 mt-20">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={submitNewExpiry}>Salvar Data</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-premium anim-slide-up">
            <h3 className="mb-16">Editar Cadastro: {editingUser.phone}</h3>
            <div className="flex flex-col gap-12">
              <div className="input-field">
                <label className="dim fs-12 mb-4 block">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full bg-slate p-8 rounded"
                  value={editingUser.name || ''} 
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div className="input-field">
                <label className="dim fs-12 mb-4 block">E-mail</label>
                <input 
                  type="email" 
                  className="w-full bg-slate p-8 rounded"
                  value={editingUser.email || ''} 
                  onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                />
              </div>
              <div className="input-field">
                <label className="dim fs-12 mb-4 block">CPF (Somente números)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate p-8 rounded"
                  value={editingUser.cpf || ''} 
                  onChange={e => setEditingUser({...editingUser, cpf: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-12 mt-32">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={submitEdit}>Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}
      <div className="welcome-section">
        <h1>Centro de <span className="gradient-text">Controle</span></h1>
        <p>Dashboard Administrativo • Gestão de Assinaturas e LGPD</p>
      </div>

      <div className="summary-grid">
        <div className="stat-card glass-premium">
          <div className="stat-header">
            <div className="icon-box blue"><Users size={24} /></div>
          </div>
          <div className="stat-body">
            <p>Total de Usuários</p>
            <h3>{stats.totalUsers}</h3>
          </div>
        </div>
        <div className="stat-card glass-premium">
          <div className="stat-header">
            <div className="icon-box green"><CreditCard size={24} /></div>
          </div>
          <div className="stat-body">
            <p>Assinantes Ativos</p>
            <h3>{stats.activeSubs}</h3>
          </div>
        </div>
        <div className="stat-card glass-premium">
          <div className="stat-header">
            <div className="icon-box red"><Activity size={24} /></div>
          </div>
          <div className="stat-body">
            <p>Faturamento Real Anual (Projetado)</p>
            <h3>R$ {subProjection[11]?.cumulativeRevenue?.toLocaleString('pt-BR') || '0'}</h3>
          </div>
        </div>
      </div>

      <section className="card glass-premium projection-card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h2>💰 Projeção de Faturamento de Assinaturas (Jan-Dez)</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subProjection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="revenue" name="Receita Bruta" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelledCount" name="Cancelamentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="activeSubscribers" name="Assinantes Reais" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
       </section>

      <div className="card glass-premium table-card">
        <div className="card-header">
          <h2>Gestão de Clientes</h2>
        </div>
        <div className="transaction-list">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>WhatsApp</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Expiração</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any, i) => (
                <tr key={i}>
                  <td className="dim">#{u._id.slice(-4)}</td>
                  <td>{u.name || "Sem Nome"}</td>
                  <td>{u.phone}</td>
                  <td>
                    <span className={`status-pill ${u.status}`}>
                      {u.status === 'active' ? 'Ativo' : u.status === 'blocked' ? 'Bloqueado' : u.status}
                    </span>
                  </td>
                  <td>
                    <select 
                      className="admin-select"
                      value={u.plan} 
                      onChange={(e) => handleStatusChange(u.phone, u.status, e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td>
                    <div className="date-cell">
                      {u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString() : '-'}
                      <button onClick={() => handleUpdateExpiry(u.phone, u.subscriptionExpiry)} className="btn-inline"><Calendar size={12} /></button>
                    </div>
                  </td>
                  <td className="actions">
                    <div className="action-buttons">
                      {u.status === 'active' ? (
                        <button onClick={() => handleCancelSub(u.phone)} className="btn-action danger" title="Cancelar e Multar"><XCircle size={18} /></button>
                      ) : (
                        <button onClick={() => handleStatusChange(u.phone, 'active', 'premium')} className="btn-action success" title="Ativar Premium"><UserPlus size={18} /></button>
                      )}
                      <button onClick={() => handleEdit(u)} className="btn-action primary" title="Editar Cadastro"><Activity size={18} /></button>
                      <button onClick={() => handleAdminResetPassword(u.phone)} className="btn-action secondary" title="Gerar Token de Senha"><Calendar size={18} /></button>
                      <button onClick={() => handleDelete(u.phone)} className="btn-action warning" title="LGPD: Excluir Permanente"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">Nenhum usuário cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ZONA DE PERIGO ESTILIZADA */}
      <section className="card glass-premium border-red-soft mt-32 p-32">
        <div className="flex justify-between items-center bg-red-opacity p-24 rounded-12">
          <div className="flex-1">
            <h3 className="text-red flex items-center gap-8 mb-8"><Trash2 size={24} /> Zona de Perigo • Manutenção Crítica</h3>
            <p className="dim fs-12">Ao clicar para resetar, **TODOS** os assinantes da base serão convertidos para o plano Free e suas expirações serão resetadas para o padrão de 7 dias. Isso removerá as barras amarelas do gráfico de projeção acima.</p>
          </div>
          <button 
            className="btn-danger-large ml-24" 
            onClick={handleResetAll}
          >
            Resetar Toda a Projeção Financeira
          </button>
        </div>
      </section>
    </div>
  );
}

export default AdminPanel;
