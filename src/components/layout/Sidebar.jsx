import React from 'react'
import { 
  LayoutDashboard, 
  Package, 
  FolderTree, 
  CreditCard, 
  ShoppingCart,
  TrendingUp,
  Box, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'finances', label: 'Financeiro & Lucros', icon: TrendingUp },
    { id: 'orders', label: 'Vendas & Pedidos', icon: ShoppingCart },
    { id: 'products', label: 'Produtos', icon: Package },
    { id: 'collections', label: 'Coleções', icon: FolderTree },
    { id: 'hero', label: 'Slides Seção Hero', icon: Sparkles },
    { id: 'integrations', label: 'Integrações (Mercado Pago)', icon: CreditCard },
  ]

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex min-h-screen">
      <div>
        {/* Brand Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Infinity 3D</h1>
            <span className="text-xs text-indigo-400 font-medium">Painel Admin</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu Principal
          </div>

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-indigo-400" />}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer Info / Status */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <div className="text-slate-200 font-medium">Supabase RLS Ativo</div>
            <div className="text-slate-500">Conexão Criptografada</div>
          </div>
        </div>

        <div className="px-2 flex items-center justify-between text-xs text-slate-500">
          <span>Versão 1.3.0</span>
          <span className="flex items-center gap-1 text-indigo-400 hover:underline cursor-pointer">
            Vitrine <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </aside>
  )
}
