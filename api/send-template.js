module.exports = async function(req, res){

  try {

    const { telefone, template, parametros = {} } = req.body

    /* ================= VALIDAÇÃO ================= */

    if(!telefone || !template){
      return res.status(400).json({
        error: "telefone ou template não enviado"
      })
    }

    const PHONE_ID = process.env.PHONE_NUMBER_ID || "1047101948485043"
    const TOKEN = process.env.WHATSAPP_TOKEN

    if(!TOKEN){
      return res.status(500).json({
        error: "WHATSAPP_TOKEN não configurado"
      })
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    console.log("📤 TEMPLATE:", template)
    console.log("📞 TELEFONE:", telefone)

    /* ================= IDIOMAS ================= */

    const TEMPLATE_IDIOMAS = {
      confirmao_de_reserva: "en_US",
      reserva_especial: "en_US",
      hello_world: "en_US"
    }

    const idioma = TEMPLATE_IDIOMAS[template]

    if(!idioma){
      return res.status(400).json({
        error: "Template não permitido ou idioma não configurado"
      })
    }

    /* ================= FUNÇÃO TEMPLATE ================= */

/* ================= BUSCAR RESERVA REAL ================= */

let dadosReserva = parametros

if(template === "confirmao_de_reserva"){

  const { data: reserva, error } = await supabase
  .from("reservas_mercatto")
  .select("*")
  .eq("telefone", telefone)
  .in("status", ["Pendente","Confirmado"])
  .order("datahora",{ ascending:false })
  .limit(1)
  .maybeSingle()

  if(error){
    console.log("❌ ERRO AO BUSCAR RESERVA:", error)
  }

  if(reserva){

    console.log("✅ RESERVA REAL ENCONTRADA:", reserva)

    const dataObj = new Date(reserva.datahora)

    const dataFormatada =
      dataObj.toLocaleDateString("pt-BR")

    const horaFormatada =
      dataObj.toTimeString().substring(0,5)

    dadosReserva = {
      nome: reserva.nome,
      data: dataFormatada,
      hora: horaFormatada,
      pessoas: reserva.pessoas
    }

  }else{

    console.log("⚠️ CLIENTE NÃO TEM RESERVA")

    dadosReserva = {
      nome: parametros.nome || "Cliente",
      data: parametros.data || "--/--",
      hora: parametros.hora || "--:--",
      pessoas: parametros.pessoas || "1"
    }

  }
}

/* ================= MONTA TEMPLATE ================= */

const templateData = montarTemplate(template, dadosReserva)

        /* ================= RESERVA ESPECIAL (VIDEO) ================= */

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
                    video: {
                      link: parametros.video
                    }
                  }
                ]
              }
            ]
          }

        /* ================= HELLO WORLD ================= */

        case "hello_world":
          return {
            name: template,
            language: { code: idioma }
          }

        default:
          return null
      }
    }

    /* ================= MONTA TEMPLATE ================= */

    const templateData = montarTemplate(template, parametros)

    if(!templateData){
      return res.status(400).json({
        error: "Template não configurado"
      })
    }

    /* ================= PAYLOAD ================= */

    const payload = {
      messaging_product: "whatsapp",
      to: telefone,
      type: "template",
      template: templateData
    }

    console.log("📦 PAYLOAD:", JSON.stringify(payload, null, 2))

    /* ================= ENVIO ================= */

    const resp = await fetch(url,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = await resp.json()

    console.log("📩 META RESPONSE:", data)

if(data.error){
  console.log("❌ ERRO META DETALHADO:", JSON.stringify(data.error, null, 2))

  return res.status(500).json({
    error: data.error
  })
}

    return res.json({
      ok:true,
      enviado:true,
      template,
      data
    })

  } catch (err){

    console.error("🔥 ERRO:", err)

    return res.status(500).json({
      error: err.message
    })
  }

}
