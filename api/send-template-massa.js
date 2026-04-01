const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/* 🔥 CONTROLE GLOBAL (em memória) */
let statusDisparo = {
  total: 0,
  enviados: 0,
  erros: 0,
  atual: null,
  finalizado: false,
  logs: []
}

module.exports = async function(req, res){

  try{

    if(req.method === "GET"){
      return res.json(statusDisparo)
    }

    let body = req.body
    if(typeof body === "string"){
      body = JSON.parse(body)
    }

    const { template, parametros = {} } = body

    if(!template){
      return res.status(400).json({ error:"template obrigatório" })
    }

    /* ================= CLIENTES ================= */

    const { data: clientes } = await supabase
      .from("memoria_clientes")
      .select("telefone, nome")
      .not("telefone","is",null)

    statusDisparo = {
      total: clientes.length,
      enviados: 0,
      erros: 0,
      atual: null,
      finalizado: false,
      logs: []
    }

    /* 🔥 RESPONDE IMEDIATO */
    res.json({ ok:true, iniciado:true })

    /* ================= DISPARO EM BACKGROUND ================= */

    ;(async () => {

      for(const cliente of clientes){

        const telefone = cliente.telefone
        statusDisparo.atual = telefone

        try{

          await fetch(`${process.env.URL}/api/send-template`,{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
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

          statusDisparo.enviados++

          statusDisparo.logs.push({
            telefone,
            status:"enviado"
          })

        }catch(e){

          statusDisparo.erros++

          statusDisparo.logs.push({
            telefone,
            status:"erro"
          })

        }

        await new Promise(r => setTimeout(r, 1500))
      }

      statusDisparo.finalizado = true

    })()

  }catch(err){
    res.status(500).json({ error: err.message })
  }

}
