const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function(req, res){

  try{

    /* ================= CORREÇÃO VERCEL BODY ================= */
    let body = req.body

    if(typeof body === "string"){
      body = JSON.parse(body)
    }

    const { template, parametros = {} } = body

    /* ================= VALIDAÇÃO ================= */

    if(!template){
      return res.status(400).json({
        error:"template obrigatório"
      })
    }

    console.log("🚀 DISPARO EM MASSA INICIADO:", template)

    /* ================= BUSCAR CLIENTES ================= */

    const { data: clientes, error } = await supabase
      .from("memoria_clientes")
      .select("telefone, nome")
      .not("telefone","is",null)

    if(error){
      return res.status(500).json({ error:error.message })
    }

    if(!clientes || clientes.length === 0){
      return res.json({
        ok:false,
        mensagem:"Nenhum cliente encontrado"
      })
    }

    console.log(`👥 Total clientes: ${clientes.length}`)

    /* ================= CONTROLE ================= */

    let enviados = 0
    let erros = 0

    /* ================= LOOP DE ENVIO ================= */

    for(const cliente of clientes){

      try{

        const telefone = cliente.telefone

        if(!telefone) continue

        console.log("📤 Enviando para:", telefone)

        await fetch(`${process.env.URL}/api/send-template`,{
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body: JSON.stringify({
            telefone,
            template,
            parametros:{
              nome: cliente.nome || "Cliente",
              data: parametros.data || "20/03",
              hora: parametros.hora || "20:00",
              pessoas: parametros.pessoas || "2"
            }
          })
        })

        enviados++

        /* ================= DELAY (ANTI BLOQUEIO META) ================= */
        await new Promise(resolve => setTimeout(resolve, 1500))

      }catch(err){

        console.log("❌ Erro ao enviar para:", cliente.telefone)
        erros++

      }

    }

    /* ================= FINAL ================= */

    console.log("✅ DISPARO FINALIZADO")

    return res.json({
      ok:true,
      total: clientes.length,
      enviados,
      erros
    })

  }catch(err){

    console.error("🔥 ERRO GERAL:", err)

    return res.status(500).json({
      error: err.message
    })

  }

}
