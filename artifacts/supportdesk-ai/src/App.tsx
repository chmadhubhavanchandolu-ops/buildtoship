import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, Bot, Check, CheckCheck, ChevronDown, CircleHelp, FileText,
  Gauge, LifeBuoy, LogOut, MessageCircle, PanelLeft, Plus, Search, Send, Settings2,
  ShieldCheck, Sparkles, TicketCheck, TrendingUp, Users, X,
} from 'lucide-react';
import {
  getGetAnalyticsQueryKey,
  getGetConversationMessagesQueryKey, getGetConversationQueryKey, getGetConversationsQueryKey,
  getGetCurrentUserQueryKey, getGetDashboardQueryKey, getGetKnowledgeBaseQueryKey, getGetSupportSettingsQueryKey, getGetUsersQueryKey,
  getGetTicketQueryKey, getGetTicketsQueryKey, useAddTicketNote, useChatWithSupportAi, useCreateConversation,
  useCreateKnowledgeArticle, useDeleteKnowledgeArticle, useDemoLogin, useDemoLogout, useEscalateConversation,
  useGetAnalytics, useGetConversation, useGetConversationMessages, useGetConversations, useGetCurrentUser,
  useGetDashboard, useGetKnowledgeBase, useGetSupportSettings, useGetTicket, useGetTickets, useGetUsers, useHealthCheck,
  useSendConversationMessage, useUpdateConversation, useUpdateKnowledgeArticle, useUpdateSupportSettings, useUpdateTicket, useUpdateUser,
} from '@workspace/api-client-react';
import type { Conversation, ConversationStatus, KnowledgeArticle } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const nav = [
  { title: 'WORKSPACE', items: [{ href: '/dashboard', label: 'Overview', icon: Gauge }, { href: '/tickets', label: 'Ticket queue', icon: TicketCheck }] },
  { title: 'KNOWLEDGE', items: [{ href: '/knowledge', label: 'Knowledge base', icon: BookOpen }, { href: '/analytics', label: 'Analytics', icon: Activity }] },
  { title: 'PREFERENCES', items: [{ href: '/settings', label: 'AI settings', icon: Settings2 }] },
];
const fmtTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Just now';
const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
const initials = (name?: string | null) => (name || 'SD').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const readable = (value?: string | null) => (value || '—').replaceAll('_', ' ');

function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn ${className}`} {...props}>{children}</button>;
}
function Status({ value }: { value?: string | null }) { return <span className={`status ${value || ''}`} data-testid={`status-${value}`}>{readable(value)}</span>; }
function Avatar({ name, dark = false }: { name?: string | null; dark?: boolean }) { return <div className={`avatar ${dark ? 'dark-a' : ''}`} data-testid={`avatar-${initials(name).toLowerCase()}`}>{initials(name)}</div>; }
function PageHead({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-head fade-in"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action}</div>;
}
function QueryState({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="load-state"><div className="skeleton" style={{ width: '44%', margin: '0 auto 13px' }} /><div className="skeleton" style={{ width: '28%', margin: '0 auto' }} /></div>;
  if (error) return <div className="error-state" role="alert"><span>We couldn't load this view. Your data is safe.</span><Button onClick={retry}><Activity /> Try again</Button></div>;
  return null;
}
function Empty({ title, copy, icon: Icon = CircleHelp }: { title: string; copy: string; icon?: typeof CircleHelp }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={20} /></div><strong>{title}</strong>{copy}</div>;
}

function Shell({ children, user }: { children: ReactNode; user: { name: string; email: string; role: string } | null }) {
  const [location, setLocation] = useLocation();
  const logout = useDemoLogout();
  const qc = useQueryClient();
  return <div className="shell">
    <aside className="sidebar">
      <Link href={user?.role === 'customer' ? '/chat' : '/dashboard'} className="brand"><span className="brand-mark"><LifeBuoy size={19} /></span>SupportDesk<span style={{ color: '#74b7a3', marginLeft: -9 }}>AI</span></Link>
      <div className="nav-label">CUSTOMER CARE</div>
      {user?.role === 'admin' && <Link href="/users" className={`nav-link ${location === '/users' ? 'active' : ''}`} data-testid="link-nav-users"><Users />Users & agents</Link>}
      {user?.role !== 'customer' && nav.map(group => {
        const items = group.items.filter(item => item.href !== '/settings' || user?.role === 'admin');
        return items.length ? <div key={group.title}><div className="nav-label">{group.title}</div>{items.map(item => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={`nav-link ${location === item.href ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><Icon />{item.label}</Link>;
        })}</div> : null;
      })}
      {user?.role === 'customer' && <Link href="/chat" className={`nav-link ${location === '/chat' ? 'active' : ''}`}><MessageCircle />Customer chat</Link>}
      <div className="side-foot"><div className="side-user"><Avatar name={user?.name} dark /><div className="side-person"><strong>{user?.name || 'Demo user'}</strong><span>{user?.role || 'visitor'} account</span></div><button className="btn ghost" title="Sign out" aria-label="Sign out" data-testid="button-logout" onClick={() => logout.mutate(undefined, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/login'); } })}><LogOut size={15} /></button></div></div>
    </aside>
    <main className="main"><header className="topbar"><Button className="ghost mobile-menu" aria-label="Go to overview" onClick={() => setLocation(user?.role === 'customer' ? '/chat' : '/dashboard')}><PanelLeft /></Button><span className="topbar-title">SUPPORT OPERATIONS <span style={{ color: '#9aaa9f', padding: '0 7px' }}>/</span> {location.replace('/', '').replaceAll('-', ' ').toUpperCase() || 'OVERVIEW'}</span><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="status ai_handling"><ShieldCheck size={12} /> Secure workspace</span><Avatar name={user?.name} /></div></header>{children}</main>
  </div>;
}

function Login() {
  const [role, setRole] = useState<'customer' | 'agent' | 'admin'>('customer');
  const [location, setLocation] = useLocation();
  const login = useDemoLogin();
  const me = useGetCurrentUser();
  const health = useHealthCheck();
  useEffect(() => { if (me.data?.user) setLocation(me.data.user.role === 'customer' ? '/chat' : '/dashboard'); }, [me.data, setLocation]);
  const descriptions = { customer: 'Ask for help and get verified answers', agent: 'Resolve escalations in the team queue', admin: 'Manage your support operation' };
  return <div className="login-wrap">
    <section className="login-story"><Link href="/login" className="brand"><span className="brand-mark"><LifeBuoy size={19} /></span>SupportDesk<span style={{ color: '#74b7a3', marginLeft: -9 }}>AI</span></Link><div className="login-copy"><span className="status ai_handling"><ShieldCheck size={13} /> TRUST, BUILT IN</span><h1>Help that knows when to ask a human.</h1><p>Verified answers for customers. Clear context for your team. Every conversation knows its next step.</p></div><span style={{ font: "10px 'IBM Plex Mono',monospace", color: '#9aafaa' }}>SUPPORT OPERATIONS PLATFORM&nbsp; · &nbsp;DEMO ACCESS</span></section>
    <section className="login-form"><div className="login-card"><div className="eyebrow">DEMO WORKSPACE</div><h2>Welcome back</h2><p>Choose a role to enter the SupportDesk demo.</p>
      <div className="role-options">{(['customer', 'agent', 'admin'] as const).map(item => <label key={item} className={`role-option ${role === item ? 'selected' : ''}`}><input type="radio" name="role" checked={role === item} onChange={() => setRole(item)} data-testid={`radio-role-${item}`} /><span><strong>{item}</strong><small>{descriptions[item]}</small></span><ArrowRight size={15} style={{ marginLeft: 'auto', color: '#608579' }} /></label>)}</div>
      {login.error && <div className="error-state" style={{ marginBottom: 12 }}>Sign in didn't go through. Please retry.</div>}
      <Button className="primary" style={{ width: '100%', height: 45 }} disabled={login.isPending} data-testid="button-demo-sign-in" onClick={() => login.mutate({ data: { role } }, { onSuccess: () => { me.refetch(); setLocation(role === 'customer' ? '/chat' : '/dashboard'); } })}>{login.isPending ? 'Opening demo…' : 'Continue to workspace'} <ArrowRight size={15} /></Button>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 10 }}>Demo API {health.data?.status === 'ok' ? 'is online' : 'connectivity checking'}</p>
    </div></section>
  </div>;
}

function Dashboard() {
  const query = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 20000 } });
  const data = query.data;
  const recent = data?.recentConversations || [];
  const stats = [
    { label: 'Active conversations', value: data?.activeConversations, sub: 'Across all channels', icon: MessageCircle },
    { label: 'Waiting for a person', value: data?.pendingEscalations, sub: 'Needs a human next', icon: Users },
    { label: 'Resolved conversations', value: data?.resolvedConversations, sub: 'All-time outcomes', icon: CheckCheck },
    { label: 'AI resolution rate', value: data ? `${Math.round(data.aiResolutionRate * 100)}%` : undefined, sub: 'Resolved without handoff', icon: Sparkles },
  ];
  return <div className="page"><PageHead eyebrow="TEAM OVERVIEW / TODAY" title="Good work starts with context." subtitle="A live view of conversations moving through your support team." action={<Link href="/tickets" className="btn primary"><TicketCheck size={15} /> Open ticket queue</Link>} />
    <QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} />
    {data && <><div className="metric-grid">{stats.map(({ label, value, sub, icon: Icon }) => <div className="panel metric" key={label}><Icon className="metric-icon" size={18} /><span className="metric-label">{label}</span><div className="metric-value">{value ?? '—'}</div><div className="metric-foot">{sub}</div></div>)}</div>
      <div className="split"><section className="panel"><div className="panel-head"><h2 className="panel-title">Recent conversations</h2><Link href="/tickets" className="linkish" style={{ fontSize: 11 }}>View queue <ArrowRight size={13} /></Link></div>
        {recent.length ? <div className="conversation-list">{recent.slice(0, 7).map((c: Conversation) => <ConversationRow key={c.id} conversation={c} />)}</div> : <Empty title="Clear skies in the queue" copy="New conversations will appear here." icon={MessageCircle} />}
      </section><section className="panel"><div className="panel-head"><h2 className="panel-title">Queue pulse</h2><Activity size={16} color="#46877a" /></div><div className="panel-body"><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 18 }}><span>Avg. first response</span><strong>{data.averageResponseMinutes} min</strong></div>{data.priorityCounts?.length ? data.priorityCounts.map((p, i) => <div key={p.label} style={{ marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 11 }}><span className={`priority ${p.label}`}>{readable(p.label)} priority</span><strong>{p.count}</strong></div><div style={{ height: 5, background: '#eeeee7', borderRadius: 5 }}><div style={{ width: `${Math.min(100, data.activeConversations ? (p.count / data.activeConversations) * 100 : 0)}%`, height: '100%', borderRadius: 5, background: ['#cd7b5b', '#d2a262', '#5d927e', '#7290a1'][i % 4] }} /></div></div>) : <Empty title="No priority data" copy="Queue breakdown will appear as cases arrive." />}</div></section></div>
    </>}
  </div>;
}
function ConversationRow({ conversation: c }: { conversation: Conversation }) {
  return <Link href={`/tickets/${c.id}`} className="conversation-row" data-testid={`link-conversation-${c.id}`}><Avatar name={c.customerName} /><div className="row-main"><strong>{c.customerName}</strong><p>{c.lastMessage || c.summary || 'No message yet'}</p><span className="row-meta">{c.intent || 'General support'} · {fmtDate(c.updatedAt)}</span></div><Status value={c.status} /></Link>;
}

function TicketList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const params = useMemo(() => ({ search: search || undefined, status: (status || undefined) as ConversationStatus | undefined, priority: (priority || undefined) as 'low' | 'medium' | 'high' | 'critical' | undefined }), [search, status, priority]);
  const q = useGetTickets(params, { query: { queryKey: getGetTicketsQueryKey(params), refetchInterval: 8000 } });
  const tickets = q.data || [];
  return <div className="page"><PageHead eyebrow="SUPPORT / QUEUE" title="Ticket queue" subtitle="Human escalations, with the customer context intact." action={<span className="status waiting_for_agent">{tickets.length} open items</span>} />
    <div className="panel"><div className="panel-head"><div className="toolbar"><label className="searchbox"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers or messages" aria-label="Search tickets" data-testid="input-search-tickets" /></label><select className="select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status" data-testid="select-ticket-status"><option value="">All statuses</option><option value="waiting_for_agent">Waiting for agent</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><select className="select" value={priority} onChange={e => setPriority(e.target.value)} aria-label="Filter by priority" data-testid="select-ticket-priority"><option value="">All priorities</option>{['critical', 'high', 'medium', 'low'].map(v => <option key={v} value={v}>{v}</option>)}</select></div><span className="row-meta">{tickets.length} RESULTS</span></div>
      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} />
      {q.data && tickets.length > 0 && <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Issue</th><th>Priority</th><th>Status</th><th>Owner</th><th>Updated</th><th /></tr></thead><tbody>{tickets.map(ticket => <tr key={ticket.id} data-testid={`row-ticket-${ticket.id}`}><td><div className="customer-cell"><Avatar name={ticket.customerName} /><span><strong>{ticket.customerName}</strong><small>{ticket.ticketNumber} · {ticket.customerEmail}</small></span></div></td><td style={{ maxWidth: 240 }}><div style={{ fontWeight: 600, marginBottom: 4 }}>{ticket.intent || 'Support request'}</div><div style={{ color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.lastMessage || ticket.summary}</div></td><td><span className={`priority ${ticket.priority}`}>{ticket.priority}</span></td><td><Status value={ticket.status} /></td><td>{ticket.assignedAgentName || <span style={{ color: '#ad693f' }}>Unassigned</span>}</td><td>{fmtDate(ticket.updatedAt)}</td><td><Link className="linkish" href={`/tickets/${ticket.id}`} data-testid={`link-ticket-${ticket.id}`}>Open <ArrowRight size={13} /></Link></td></tr>)}</tbody></table></div>}
      {q.data && !tickets.length && <Empty title="No tickets match those filters" copy="Try a different search or clear a filter." icon={Search} />}
    </div>
  </div>;
}

function TicketDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id || '';
  const q = useGetTicket(id, { query: { enabled: !!id, queryKey: getGetTicketQueryKey(id), refetchInterval: 3500 } });
  const send = useSendConversationMessage();
  const note = useAddTicketNote();
  const update = useUpdateTicket();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const [noteText, setNoteText] = useState('');
  const t = q.data;
  const refresh = () => { qc.invalidateQueries({ queryKey: getGetTicketQueryKey(id) }); qc.invalidateQueries({ queryKey: getGetTicketsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(id) }); };
  const submitReply = (e: FormEvent) => { e.preventDefault(); if (!reply.trim()) return; send.mutate({ id, data: { content: reply.trim() } }, { onSuccess: () => { setReply(''); refresh(); } }); };
  const submitNote = (e: FormEvent) => { e.preventDefault(); if (!noteText.trim()) return; note.mutate({ id, data: { content: noteText.trim() } }, { onSuccess: () => { setNoteText(''); refresh(); } }); };
  return <div className="page"><PageHead eyebrow="SUPPORT / TICKET" title={t?.customerName || 'Ticket details'} subtitle={t ? `${t.ticketNumber} · Opened ${fmtDate(t.createdAt)} · Waiting since ${fmtDate(t.waitingSince)}` : 'Conversation details and agent actions.'} action={<Link href="/tickets" className="btn"><ArrowLeft /> Back to queue</Link>} />
    <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} />
    {t && <><div className="ticket-head"><Avatar name={t.customerName} /><div style={{ flex: 1 }}><strong>{t.customerName}</strong><div className="row-meta">{t.customerEmail}</div></div><Status value={t.status} /><span className={`priority ${t.priority}`}>{t.priority} priority</span><Button disabled={update.isPending || t.status === 'resolved'} className="primary" data-testid="button-resolve-ticket" onClick={() => update.mutate({ id, data: { status: 'resolved' } }, { onSuccess: refresh })}><Check size={14} /> Resolve</Button></div>
      <div className="ticket-columns"><section className="panel"><div className="panel-head"><h2 className="panel-title">Conversation</h2><span className="row-meta">{t.messages.length} MESSAGES</span></div><div>{t.messages.map(m => <div className="ticket-message" key={m.id}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={m.senderName} /><strong style={{ fontSize: 12 }}>{m.senderName}</strong><span className="row-meta">{readable(m.senderType)} · {fmtTime(m.createdAt)}</span>{m.confidence != null && <span className="tag" style={{ marginLeft: 'auto' }}>{Math.round(m.confidence * 100)}% confidence</span>}</div><p>{m.content}</p></div>)}</div>
        {t.status !== 'resolved' && <form className="chat-compose" style={{ padding: 14 }} onSubmit={submitReply}><textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a thoughtful reply…" aria-label="Agent reply" data-testid="input-agent-reply" /><Button className="primary" disabled={!reply.trim() || send.isPending} aria-label="Send agent reply" data-testid="button-send-reply"><Send /></Button></form>}</section>
        <aside><div className="panel" style={{ marginBottom: 14 }}><div className="panel-head"><h2 className="panel-title">AI handoff</h2><Bot size={16} color="#438176" /></div><div className="panel-body"><div className="summary-block"><strong>Conversation summary</strong>{t.summary || 'No handoff summary has been added yet.'}</div><div style={{ fontSize: 11, margin: '12px 0' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>Detected intent</span><strong style={{ float: 'right' }}>{t.intent || 'Unclassified'}</strong></div><div style={{ fontSize: 11, margin: '12px 0' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>AI confidence</span><strong style={{ float: 'right' }}>{t.aiConfidence == null ? '—' : `${Math.round(t.aiConfidence * 100)}%`}</strong></div><div className="summary-block"><strong>Why it reached a human</strong>{t.escalationReason || 'Customer requested team assistance.'}</div><div className="summary-block"><strong>Recommended next step</strong>{t.recommendedNextAction || 'Review the conversation and reply to the customer.'}</div><Button className="primary" style={{ width: '100%' }} disabled={update.isPending} data-testid="button-take-ticket" onClick={() => update.mutate({ id, data: { takeOver: true, status: 'in_progress' } }, { onSuccess: refresh })}><Users size={14} /> Take ownership</Button></div></div>
          <div className="panel"><div className="panel-head"><h2 className="panel-title">Internal notes</h2><FileText size={15} /></div><div className="panel-body">{t.internalNotes.length ? t.internalNotes.map(n => <div className="note-item" key={n.id}><strong>{n.authorName}</strong><span style={{ color: '#877e66', float: 'right' }}>{fmtTime(n.createdAt)}</span><div>{n.content}</div></div>) : <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Private notes are visible to your team only.</p>}<form onSubmit={submitNote}><div className="form-field"><textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a private note…" aria-label="Internal note" data-testid="input-internal-note" /></div><Button disabled={!noteText.trim() || note.isPending} style={{ width: '100%' }} data-testid="button-add-note">{note.isPending ? 'Saving…' : 'Add internal note'} <Plus size={13} /></Button></form></div></div></aside>
      </div></>}
  </div>;
}

function Knowledge() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [creating, setCreating] = useState(false);
  const params = useMemo(() => ({ search: search || undefined, category: category || undefined }), [search, category]);
  const q = useGetKnowledgeBase(params);
  const create = useCreateKnowledgeArticle();
  const update = useUpdateKnowledgeArticle();
  const remove = useDeleteKnowledgeArticle();
  const qc = useQueryClient();
  const articles = q.data || [];
  const categories = [...new Set(articles.map(a => a.category))];
  const save = (data: { question: string; answer: string; category: string; keywords: string[] }) => {
    const opts = { onSuccess: () => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: getGetKnowledgeBaseQueryKey() }); } };
    if (editing) update.mutate({ id: editing.id, data }, opts); else create.mutate({ data }, opts);
  };
  return <div className="page"><PageHead eyebrow="KNOWLEDGE / LIBRARY" title="Knowledge base" subtitle="Trusted source material for clear, verified answers." action={<Button className="primary" onClick={() => setCreating(true)} data-testid="button-new-article"><Plus /> New article</Button>} />
    <div className="panel"><div className="panel-head"><div className="toolbar"><label className="searchbox"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions, answers, keywords" aria-label="Search knowledge base" data-testid="input-search-knowledge" /></label><select className="select" value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category" data-testid="select-knowledge-category"><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div><span className="row-meta">{articles.length} ARTICLES</span></div>
      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} />
      {q.data && (articles.length ? <div className="panel-body"><div className="article-grid">{articles.map(a => <article className="panel article-card" key={a.id} data-testid={`card-article-${a.id}`}><span className="tag">{a.category}</span><h3>{a.question}</h3><p>{a.answer}</p><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{a.keywords.map(k => <span className="row-meta" key={k}>#{k}</span>)}</div><div className="article-actions"><span className="row-meta">UPDATED {fmtDate(a.updatedAt)}</span><div><Button className="ghost" aria-label={`Edit ${a.question}`} onClick={() => setEditing(a)} data-testid={`button-edit-article-${a.id}`}>Edit</Button><Button className="ghost danger" aria-label={`Delete ${a.question}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete “${a.question}”?`)) remove.mutate({ id: a.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetKnowledgeBaseQueryKey() }) }); }} data-testid={`button-delete-article-${a.id}`}>Delete</Button></div></div></article>)}</div></div> : <Empty title="No matching knowledge yet" copy="Adjust your search or add a trusted answer." icon={BookOpen} />)}
    </div>
    {(creating || editing) && <ArticleModal article={editing} pending={create.isPending || update.isPending} onClose={() => { setCreating(false); setEditing(null); }} onSave={save} />}
  </div>;
}
function ArticleModal({ article, pending, onClose, onSave }: { article: KnowledgeArticle | null; pending: boolean; onClose: () => void; onSave: (data: { question: string; answer: string; category: string; keywords: string[] }) => void }) {
  const [question, setQuestion] = useState(article?.question || '');
  const [answer, setAnswer] = useState(article?.answer || '');
  const [category, setCategory] = useState(article?.category || '');
  const [keywords, setKeywords] = useState(article?.keywords.join(', ') || '');
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><form className="modal" onSubmit={e => { e.preventDefault(); onSave({ question, answer, category, keywords: keywords.split(',').map(x => x.trim()).filter(Boolean) }); }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h2>{article ? 'Edit knowledge article' : 'New knowledge article'}</h2><p>Keep answers specific, reviewed, and easy to reuse.</p></div><Button className="ghost" type="button" onClick={onClose} aria-label="Close editor"><X /></Button></div><div className="form-field"><label>Question</label><input value={question} onChange={e => setQuestion(e.target.value)} required minLength={3} aria-label="Article question" data-testid="input-article-question" /></div><div className="form-field"><label>Answer</label><textarea value={answer} onChange={e => setAnswer(e.target.value)} required minLength={3} aria-label="Article answer" data-testid="input-article-answer" /></div><div className="form-field"><label>Category</label><input value={category} onChange={e => setCategory(e.target.value)} required aria-label="Article category" data-testid="input-article-category" /></div><div className="form-field"><label>Keywords <span style={{ fontWeight: 400, color: '#777' }}>· comma separated</span></label><input value={keywords} onChange={e => setKeywords(e.target.value)} aria-label="Article keywords" data-testid="input-article-keywords" /></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}><Button type="button" onClick={onClose}>Cancel</Button><Button className="primary" disabled={pending || !question.trim() || !answer.trim() || !category.trim()} data-testid="button-save-article">{pending ? 'Saving…' : article ? 'Save changes' : 'Create article'}</Button></div></form></div>;
}

function AnalyticsPage() {
  const q = useGetAnalytics({ query: { queryKey: getGetAnalyticsQueryKey(), refetchInterval: 30000 } });
  const d = q.data;
  const metrics = [{ label: 'Conversations', val: d?.totalConversations, helper: 'All conversations' }, { label: 'AI-resolved', val: d?.aiResolvedConversations, helper: 'No agent handoff' }, { label: 'Human escalations', val: d?.humanEscalatedConversations, helper: 'Handled by your team' }, { label: 'Resolution rate', val: d ? `${Math.round(d.aiResolutionRate * 100)}%` : undefined, helper: 'Resolved by AI' }];
  const max = Math.max(1, ...(d?.weeklyVolume || []).map(x => x.conversations));
  return <div className="page"><PageHead eyebrow="INSIGHTS / PERFORMANCE" title="The shape of support." subtitle="Measure speed, resolution, and the moments that need a person." />
    <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} />
    {d && <><div className="metric-grid">{metrics.map(m => <div className="panel metric" key={m.label}><span className="metric-label">{m.label}</span><div className="metric-value">{m.val ?? '—'}</div><div className="metric-foot">{m.helper}</div></div>)}</div>
      <div className="split"><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Conversation volume</h2><span className="row-meta">THIS WEEK · DAILY TOTALS</span></div><div className="toolbar"><span className="tag">Conversations</span><span className="tag" style={{ background: '#f5ece2', color: '#9c7044' }}>AI resolved</span></div></div><div className="panel-body"><div className="chart">{d.weeklyVolume.map(day => <div className="chart-column" key={day.day}><span className="row-meta">{day.conversations}</span><div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '72%', width: '100%', justifyContent: 'center' }}><div className="chart-bar" style={{ height: `${Math.max(3, day.conversations / max * 100)}%` }} /><div className="chart-bar secondary" style={{ height: `${Math.max(2, day.aiResolved / max * 100)}%` }} /></div><span className="chart-label">{day.day}</span></div>)}</div></div></section>
        <section className="panel"><div className="panel-head"><h2 className="panel-title">Resolution health</h2><TrendingUp size={16} color="#458579" /></div><div className="panel-body">{[{ label: 'Avg. first response', val: `${d.averageResponseMinutes} min` }, { label: 'Avg. time to resolution', val: `${d.averageResolutionMinutes} min` }, { label: 'Open tickets', val: d.openTickets }, { label: 'Resolved tickets', val: d.resolvedTickets }].map(x => <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 2px', borderBottom: '1px solid hsl(var(--border))', fontSize: 12 }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>{x.label}</span><strong>{x.val}</strong></div>)}</div></section></div>
      <section className="panel" style={{ marginTop: 17 }}><div className="panel-head"><h2 className="panel-title">Conversation outcomes</h2><span className="row-meta">BY STATUS</span></div><div className="panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>{d.statusBreakdown.map(s => <div key={s.label} style={{ minWidth: 145, padding: 15, borderRadius: 9, background: '#f4f3ec' }}><span className="row-meta">{readable(s.label)}</span><div style={{ font: '700 22px Manrope', marginTop: 7 }}>{s.count}</div></div>)}</div></section>
    </>}
  </div>;
}

function SettingsPage() {
  const q = useGetSupportSettings();
  const mutate = useUpdateSupportSettings();
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState<number | null>(null);
  useEffect(() => { if (q.data) setThreshold(q.data.confidenceThreshold); }, [q.data]);
  const value = threshold ?? q.data?.confidenceThreshold ?? 0.7;
  const save = () => mutate.mutate({ data: { confidenceThreshold: value } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSupportSettingsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } });
  return <div className="page"><PageHead eyebrow="PREFERENCES / AI" title="Human judgment, by design." subtitle="Set when the assistant should pause and bring your team in." />
    <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} />
    {q.data && <div className="panel" style={{ maxWidth: 810 }}><div className="panel-head"><div><h2 className="panel-title">Escalation confidence</h2><span className="row-meta">SAFE ANSWER THRESHOLD</span></div><span className="tag">{Math.round(value * 100)}% confidence</span></div><div className="panel-body"><div className="summary-block"><strong>How this works</strong>When the assistant's confidence in a verified answer falls below your threshold, the conversation is escalated to a human agent. Higher thresholds mean more conversations reach your team.</div><div className="settings-row"><div><strong style={{ fontSize: 13 }}>Minimum answer confidence</strong><p className="page-subtitle" style={{ marginTop: 4 }}>Below this score, ask an agent instead of guessing.</p></div><input className="range" type="range" min="0.4" max="0.95" step="0.01" value={value} onChange={e => setThreshold(Number(e.target.value))} aria-label="Confidence threshold" data-testid="input-confidence-threshold" /><strong style={{ font: "600 13px 'IBM Plex Mono',monospace", minWidth: 40 }}>{Math.round(value * 100)}%</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}><span className="row-meta">Changes affect new conversations.</span><Button className="primary" disabled={mutate.isPending || value === q.data.confidenceThreshold} onClick={save} data-testid="button-save-settings">{mutate.isPending ? 'Saving…' : 'Save threshold'} <Check size={14} /></Button></div></div></div>}
  </div>;
}

function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const params = useMemo(() => ({ search: search || undefined, role: (role || undefined) as 'customer' | 'agent' | 'admin' | undefined }), [search, role]);
  const query = useGetUsers(params);
  const update = useUpdateUser();
  const qc = useQueryClient();
  const users = query.data || [];
  const roleCounts = { customer: users.filter(user => user.role === 'customer').length, agent: users.filter(user => user.role === 'agent').length, admin: users.filter(user => user.role === 'admin').length };
  return <div className="page-wrap">
    <PageHead eyebrow="ADMINISTRATION" title="Users & agents" subtitle="Review demo accounts and assign customer, agent, or administrator access." />
    <QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} />
    {query.data && <>
      <div className="metric-grid" style={{ marginBottom: 16 }}>
        {([['Customers', roleCounts.customer], ['Agents', roleCounts.agent], ['Admins', roleCounts.admin]] as const).map(([label, count]) => <div className="panel metric" key={label}><span className="metric-label">{label}</span><strong>{count}</strong></div>)}
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2 className="panel-title">Account directory</h2><span className="row-meta">Role changes apply immediately</span></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Search users" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-user-search" /><select aria-label="Filter by role" value={role} onChange={e => setRole(e.target.value)} data-testid="select-user-role"><option value="">All roles</option><option value="customer">Customers</option><option value="agent">Agents</option><option value="admin">Admins</option></select></div></div>
        {users.length ? <div className="panel-body" style={{ display: 'grid', gap: 0 }}>{users.map(account => <div key={account.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1fr) minmax(145px, 190px)', gap: 14, alignItems: 'center', padding: '13px 2px', borderBottom: '1px solid #edf0ec' }} data-testid={`user-row-${account.id}`}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={account.name} /><div><strong style={{ fontSize: 12 }}>{account.name}</strong><div className="row-meta">{account.id}</div></div></div><span style={{ fontSize: 12, color: '#67756d', overflowWrap: 'anywhere' }}>{account.email}</span><select aria-label={`Role for ${account.name}`} value={account.role} disabled={update.isPending} onChange={e => update.mutate({ id: account.id, data: { role: e.target.value as 'customer' | 'agent' | 'admin' } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetUsersQueryKey() }) })} data-testid={`select-role-${account.id}`}><option value="customer">Customer</option><option value="agent">Agent</option><option value="admin">Admin</option></select></div>)}</div> : <Empty title="No accounts found" copy="Try a different search or role filter." icon={Users} />}
      </div>
    </>}
    <p className="row-meta" style={{ marginTop: 12 }}>This demo workspace uses preloaded accounts. Role assignment is for demonstration and is not an invitation or production identity workflow.</p>
  </div>;
}

function CustomerChat({ user }: { user: { name: string; email: string } | null }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [first, setFirst] = useState('');
  const [newConversation, setNewConversation] = useState(false);
  const conversationsQuery = useGetConversations({ limit: 50 }, { query: { queryKey: getGetConversationsQueryKey({ limit: 50 }), refetchInterval: 8000 } });
  const conversations = conversationsQuery.data || [];
  useEffect(() => { if (!selectedId && !newConversation && conversations[0]) setSelectedId(conversations[0].id); }, [conversations, selectedId, newConversation]);
  const detail = useGetConversation(selectedId, { query: { enabled: !!selectedId, queryKey: getGetConversationQueryKey(selectedId), refetchInterval: 5000 } });
  const messagesQuery = useGetConversationMessages(selectedId, { query: { enabled: !!selectedId, queryKey: getGetConversationMessagesQueryKey(selectedId), refetchInterval: 3000 } });
  const send = useSendConversationMessage();
  const askAi = useChatWithSupportAi();
  const create = useCreateConversation();
  const escalate = useEscalateConversation();
  const updateConversation = useUpdateConversation();
  const [mode, setMode] = useState<'ai' | 'create'>('ai');
  const messages = messagesQuery.data || detail.data?.messages || [];
  const refresh = (id?: string) => { qc.invalidateQueries({ queryKey: getGetConversationsQueryKey() }); if (id || selectedId) { qc.invalidateQueries({ queryKey: getGetConversationQueryKey(id || selectedId) }); qc.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(id || selectedId) }); } };
  const submitFirst = (e: FormEvent) => { e.preventDefault(); if (!first.trim()) return; const payload = { customerName: user?.name || 'Demo Customer', customerEmail: user?.email || 'customer@supportdesk.demo', message: first.trim() }; const success = (r: any) => { const c = r.conversation || r; setSelectedId(c.id); setNewConversation(false); setFirst(''); refresh(c.id); }; if (mode === 'ai') askAi.mutate({ data: payload }, { onSuccess: success }); else create.mutate({ data: payload }, { onSuccess: success }); };
  const submit = (e: FormEvent) => { e.preventDefault(); if (!draft.trim() || !selectedId) return; send.mutate({ id: selectedId, data: { content: draft.trim() } }, { onSuccess: () => { setDraft(''); refresh(); } }); };
  const loading = askAi.isPending || create.isPending || send.isPending;
  return <div className="chat-layout"><aside className="chat-history"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><h3 style={{ margin: 0 }}>Your conversations</h3><Button className="ghost" aria-label="Start a new conversation" title="Start a new conversation" onClick={() => { setSelectedId(''); setNewConversation(true); setFirst(''); }} data-testid="button-new-conversation"><Plus size={15} /></Button></div>{conversationsQuery.isLoading && <div className="skeleton" style={{ width: 150 }} />}{conversations.map(c => <button className={`history-item ${selectedId === c.id ? 'active' : ''}`} key={c.id} onClick={() => { setSelectedId(c.id); setNewConversation(false); }} data-testid={`button-history-${c.id}`}><strong>{c.intent || c.lastMessage || 'Support conversation'}</strong><small>{readable(c.status)} · {fmtDate(c.updatedAt)}</small></button>)}{conversationsQuery.data && !conversations.length && <div style={{ fontSize: 11, color: '#74827d', padding: 10 }}>No conversations yet.</div>}</aside>
    <section className="chat-center"><header className="chat-header"><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div className="avatar" style={{ background: '#e0eee6' }}><Bot size={17} /></div><div><strong style={{ fontSize: 13 }}>Support assistant</strong><div className="row-meta">Verified knowledge · Human team available</div></div></div>{selectedId && detail.data && <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Status value={detail.data.status} /><Button className="ghost" disabled={escalate.isPending || detail.data.status === 'waiting_for_agent'} onClick={() => escalate.mutate({ id: selectedId, data: { reason: 'Customer requested a human agent' } }, { onSuccess: () => refresh() })} data-testid="button-escalate"><Users size={14} /> Talk to a person</Button>{detail.data.status !== 'resolved' && <Button className="ghost" disabled={updateConversation.isPending} onClick={() => updateConversation.mutate({ id: selectedId, data: { status: 'resolved' } }, { onSuccess: () => refresh() })} data-testid="button-close-conversation"><Check size={14} /> Close</Button>}</div>}</header>
      <div className="chat-stream">{(detail.isLoading || messagesQuery.isLoading) && selectedId && <div className="load-state"><div className="skeleton" style={{ width: '60%', margin: '10px auto' }} /><div className="skeleton" style={{ width: '40%', margin: '18px 0 18px auto' }} /></div>}
         {!selectedId && !conversationsQuery.isLoading && <div style={{ maxWidth: 550, margin: '42px auto', textAlign: 'center' }}><div className="empty-icon"><Sparkles size={21} /></div><div className="eyebrow">SUPPORT THAT KNOWS ITS SOURCES</div><h2 style={{ font: '700 24px Manrope', letterSpacing: '-.7px' }}>What can we help you with?</h2><p className="page-subtitle">Ask a question and we’ll look for a verified answer. If it needs a person, we’ll make the handoff clear.</p>{!conversations.length && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 18 }}>{['How can I reset my password?', 'Where can I check my order?', 'What payment methods do you accept?', 'How do I request a refund?'].map(question => <Button key={question} className="ghost" onClick={() => setFirst(question)} data-testid={`button-suggestion-${question.slice(0, 10).replaceAll(' ', '-').toLowerCase()}`}>{question}</Button>)}</div>}</div>}
         {messages.map(m => <div className={`message ${m.senderType === 'customer' ? 'mine' : ''}`} key={m.id} data-testid={`message-${m.id}`}><Avatar name={m.senderName} /><div><div className="bubble">{m.content}</div><div className="message-meta">{m.senderName} · {fmtTime(m.createdAt)} {m.confidence != null && `· ${Math.round(m.confidence * 100)}% confidence`}</div>{m.senderType === 'ai' && detail.data?.status !== 'waiting_for_agent' && <button className="btn ghost" style={{ padding: '4px 7px', marginTop: 4, fontSize: 10 }} onClick={() => escalate.mutate({ id: selectedId, data: { reason: 'The customer indicated that the AI response was not helpful.' } }, { onSuccess: () => refresh() })} disabled={escalate.isPending} data-testid={`button-not-helpful-${m.id}`}>Not helpful? Ask an agent</button>}</div></div>)}
        {selectedId && detail.data?.status === 'waiting_for_agent' && <div className="summary-block" style={{ maxWidth: 620, margin: '15px auto' }}><strong>Our team has the conversation</strong>A support specialist will pick this up with the context above.</div>}
      </div>
      {!selectedId ? <form className="chat-compose" onSubmit={submitFirst}><textarea value={first} onChange={e => setFirst(e.target.value)} placeholder="Describe what you need help with…" aria-label="Your question" data-testid="input-first-question" /><Button className="primary" disabled={!first.trim() || loading} aria-label="Send question" data-testid="button-start-chat"><Send /></Button></form> : <form className="chat-compose" onSubmit={submit}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" aria-label="Chat message" data-testid="input-chat-message" /><Button className="primary" disabled={!draft.trim() || loading || detail.data?.status === 'resolved'} aria-label="Send message" data-testid="button-send-chat"><Send /></Button></form>}
      {!selectedId && <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px 12px' }}><button className="btn ghost" onClick={() => setMode(mode === 'ai' ? 'create' : 'ai')} type="button" data-testid="button-chat-mode"><ShieldCheck size={13} /> {mode === 'ai' ? 'Verified-answer chat' : 'Standard support chat'} <ChevronDown size={13} /></button></div>}
    </section>
  </div>;
}

function Router() {
  const [location, setLocation] = useLocation();
  const me = useGetCurrentUser();
  const current = me.data?.user || null;
  useEffect(() => { if (location !== '/login' && !me.isLoading && !current) setLocation('/login'); }, [location, me.isLoading, current, setLocation]);
  if (location === '/login') return <Login />;
  if (me.isLoading) return <div className="load-state" style={{ minHeight: '100dvh', display: 'grid', alignContent: 'center' }}><div className="skeleton" style={{ width: 210, margin: '0 auto 12px' }} /><span>Opening your workspace…</span></div>;
  if (!current) return <Login />;
  return <Shell user={current}><ErrorBoundary resetKey={location}><Switch>
    <Route path="/chat">{current.role === 'customer' ? <CustomerChat user={current} /> : <NotFound />}</Route>
    <Route path="/dashboard">{current.role !== 'customer' ? <Dashboard /> : <NotFound />}</Route>
    <Route path="/tickets">{current.role !== 'customer' ? <TicketList /> : <NotFound />}</Route>
    <Route path="/tickets/:id">{current.role !== 'customer' ? <TicketDetail /> : <NotFound />}</Route>
    <Route path="/knowledge">{current.role !== 'customer' ? <Knowledge /> : <NotFound />}</Route>
    <Route path="/analytics">{current.role !== 'customer' ? <AnalyticsPage /> : <NotFound />}</Route>
    <Route path="/settings">{current.role === 'admin' ? <SettingsPage /> : <NotFound />}</Route>
    <Route path="/users">{current?.role === 'admin' ? <UsersPage /> : <NotFound />}</Route>
    <Route path="/">{current.role === 'customer' ? <CustomerChat user={current} /> : <Dashboard />}</Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary></Shell>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}
export default App;
