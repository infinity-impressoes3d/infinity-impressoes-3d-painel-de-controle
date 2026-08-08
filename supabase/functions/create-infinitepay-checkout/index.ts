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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Busca o Handle da InfinitePay no banco
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

    const { items, totalAmount, redirectUrl, orderId } = await req.json()

    const cleanHandle = handle.trim().replace(/^@/, '')
    const amountInCents = Math.round((Number(totalAmount) || 0) * 100)

    let checkoutUrl = `https://pay.infinitepay.io/${cleanHandle}`

    // Se houver um valor total informado, adiciona aos parâmetros da URL
    if (amountInCents > 0) {
      const params = new URLSearchParams()
      params.append('amount', amountInCents.toString())
      if (orderId) params.append('order_id', orderId)
      if (redirectUrl) params.append('redirect_url', redirectUrl)
      
      checkoutUrl = `https://pay.infinitepay.io/${cleanHandle}?${params.toString()}`
    }

    // Se possuir API Token, tenta gerar via API oficial Cloudwalk / InfinitePay
    if (apiToken) {
      try {
        const apiRes = await fetch('https://api.infinitepay.io/v1/checkouts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            handle: cleanHandle,
            amount: amountInCents,
            order_id: orderId,
            redirect_url: redirectUrl || 'https://infinity-impressoes3d.vercel.app/#/sucesso'
          })
        })

        if (apiRes.ok) {
          const apiData = await apiRes.json()
          if (apiData.checkout_url || apiData.url) {
            checkoutUrl = apiData.checkout_url || apiData.url
          }
        }
      } catch (e) {
        console.log('Utilizando link direto do Handle InfinitePay');
      }
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
