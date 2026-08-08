import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const webhookSecret = Deno.env.get('INFINITEPAY_WEBHOOK_SECRET') || 'infinity_3d_secret_token_2026'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Busca as configurações da InfinitePay no banco (store_settings ou payment_credentials)
    const { data: settings } = await supabase
      .from('store_settings')
      .select('infinitepay_handle, infinitepay_api_token')
      .single()

    let handle = settings?.infinitepay_handle
    let apiToken = settings?.infinitepay_api_token

    if (!handle) {
      const { data: creds } = await supabase
        .from('payment_credentials')
        .select('public_key, access_token')
        .eq('provider', 'infinitepay')
        .single()

      handle = creds?.public_key
      if (!apiToken) apiToken = creds?.access_token
    }

    if (!handle) {
      return new Response(
        JSON.stringify({ 
          error: 'As configurações da InfinitePay (Handle / InfiniteTag) ainda não foram cadastradas no Painel de Controle.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { orderId, redirectUrl: clientRedirectUrl, items: clientItems, totalAmount: clientTotal } = body

    const cleanHandle = handle.trim().replace(/^@/, '')
    let totalAmountInCents = 0
    let itemsPayload: Array<{ quantity: number; price: number; description: string }> = []

    // 2. Busca o pedido real no banco de dados para evitar manipulação de preços pelo navegador
    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

      if (order) {
        totalAmountInCents = Math.round((Number(order.total_amount) || 0) * 100)
        
        if (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0) {
          itemsPayload = order.order_items.map((item: any) => ({
            quantity: Number(item.quantity) || 1,
            price: Math.round((Number(item.unit_price || item.price) || 0) * 100),
            description: (item.product_title || item.title || item.name || 'Produto Impressão 3D').substring(0, 60)
          }))
          
          if (Number(order.shipping_cost) > 0) {
            itemsPayload.push({
              quantity: 1,
              price: Math.round(Number(order.shipping_cost) * 100),
              description: 'Frete de Entrega'
            })
          }
        }
      }
    }

    // Se o pedido não foi encontrado no banco (ou itens não estruturados), usa os itens informados com fallback seguro
    if (totalAmountInCents === 0) {
      totalAmountInCents = Math.round((Number(clientTotal) || 0) * 100)
      if (Array.isArray(clientItems) && clientItems.length > 0) {
        itemsPayload = clientItems.map((item: any) => ({
          quantity: Number(item.quantity) || 1,
          price: Math.round((Number(item.price) || 0) * 100),
          description: String(item.name || item.title || 'Produto').substring(0, 60)
        }))
      }
    }

    if (itemsPayload.length === 0 && totalAmountInCents > 0) {
      itemsPayload = [{
        quantity: 1,
        price: totalAmountInCents,
        description: `Pedido ${orderId ? `#${orderId.substring(0, 8)}` : 'Infinity 3D'}`
      }]
    }

    const redirectUrl = clientRedirectUrl || 'https://infinity-impressoes3d.vercel.app/#/sucesso'
    const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook?secret=${webhookSecret}`

    // Link padrão de fallback direto do Handle
    let checkoutUrl = `https://pay.infinitepay.io/${cleanHandle}`
    if (totalAmountInCents > 0) {
      const params = new URLSearchParams()
      params.append('amount', totalAmountInCents.toString())
      if (orderId) params.append('order_id', orderId)
      if (redirectUrl) params.append('redirect_url', redirectUrl)
      checkoutUrl = `https://pay.infinitepay.io/${cleanHandle}?${params.toString()}`
    }

    // 3. Tenta criar o link oficial via API da InfinitePay (https://api.checkout.infinitepay.io/links)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`
      }

      const apiRes = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          handle: cleanHandle,
          redirect_url: redirectUrl,
          webhook_url: webhookUrl,
          order_nsu: orderId || `order_${Date.now()}`,
          items: itemsPayload
        })
      })

      if (apiRes.ok) {
        const apiData = await apiRes.json()
        if (apiData.url || apiData.checkout_url) {
          checkoutUrl = apiData.url || apiData.checkout_url
        }
      } else {
        console.log('Tentativa de API retornou status:', apiRes.status, 'Utilizando fallback do Handle.');
      }
    } catch (e) {
      console.log('Erro ao conectar com API InfinitePay, utilizando link direto:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        checkoutUrl: checkoutUrl,
        handle: cleanHandle
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro ao gerar checkout da InfinitePay.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
