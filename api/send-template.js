const fetch = require("node-fetch")
const { createClient } = require("@supabase/supabase-js")

module.exports = async function(req, res){

  try {

    /* ================= DADOS ================= */

    const { telefone, template, parametros = {} } = req.body || {}

    if(!telefone || !template){
      return res.status(400).json({
        error: "telefone ou template não enviado"
      })
    }

    const PHONE_ID = process.env.PHONE_NUMBER_ID
    const TOKEN = process.env.WHATSAPP_TOKEN

    if(!TOKEN || !PHONE_ID){
      return res.status(500).json({
        error: "TOKEN ou PHONE_ID não configurado"
      })
    }

    const numero = telefone.replace(/\D/g,"")

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    console.log("📤 TEMPLATE:", template)
    console.log("📞 TELEFONE:", numero)

    /* ================= IDIOMAS ================= */

    const TEMPLATE_IDIOMAS = {
      confirmao_de_reserva: "en_US",
      reserva_especial: "en_US",
      hello_world: "en_US"
    }

    const idioma = TEMPLATE_IDIOMAS[template]

    if(!idioma){
      return res.status(400).json({
        error: "Template não permitido"
      })
    }

    /* ================= TEMPLATE ================= */

    function montarTemplate(){

      switch(template){

        case "confirmao_de_reserva":
          return {
            name: template,
            language: { code: idioma },
            components: [
              {
                type: "body",
                parameters: [
                  { type:"text", text: parametros.nome || "Cliente" },
                  { type:"text", text: parametros.data || "20/03" },
                  { type:"text", text: parametros.hora || "20:00" },
                  { type:"text", text: parametros.pessoas || "2" }
                ]
              }
            ]
          }

        case "reserva_especial":

          if(!parametros.video){
            throw new Error("Template reserva_especial precisa de video")
          }

          return {
            name: template,
            language: { code: idioma },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "video",
                    video: { link: parametros.video }
                  }
                ]
              }
            ]
          }

        case "hello_world":
          return {
            name: template,
            language: { code: idioma }
          }

        default:
          return null
      }
    }

    const templateData = montarTemplate()

    if(!templateData){
      return res.status(400).json({
        error: "Template inválido"
      })
    }

    /* ================= PAYLOAD ================= */

    const payload = {
      messaging_product: "whatsapp",
      to: numero,
      type: "template",
      template: templateData
    }

    console.log("📦 PAYLOAD:", JSON.stringify(payload, null, 2))

    /* ================= ENVIO META ================= */

    const resp = await fetch(url,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify(payload)
    })

    let data

    try{
      data = await resp.json()
    }catch{
      const text = await resp.text()

      console.error("❌ META NÃO JSON:", text)

      return res.status(500).json({
        error: "Meta retornou resposta inválida",
        raw: text
      })
    }

    /* ================= ERRO META ================= */

    if(!resp.ok || data.error){
      console.error("❌ ERRO META:", JSON.stringify(data, null, 2))

      return res.status(500).json({
        error: data
      })
    }

    console.log("📩 META OK:", data)

    /* ================= SALVAR SUPABASE ================= */

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    )

    const messageId =
      data?.messages?.[0]?.id ||
      data?.data?.messages?.[0]?.id ||
      null

    const { error } = await supabase
      .from("conversas_whatsapp")
      .insert({
        telefone: numero,
        mensagem: JSON.stringify({
          template,
          parametros
        }),
        tipo: "template",
        role: "assistant",
        message_id: messageId,
        status: "sent",
        created_at: new Date().toISOString()
      })

    if(error){
      console.error("❌ ERRO SUPABASE:", error)
    }else{
      console.log("💾 SALVO NO BANCO")
    }

    /* ================= RESPOSTA FINAL ================= */

    return res.status(200).json({
      ok:true,
      enviado:true,
      template,
      data
    })

  } catch (err){

    console.error("🔥 ERRO GERAL:", err)

    return res.status(500).json({
      error: err.message || err
    })
  }

}
