const express = require("express")
const router = express.Router()

router.get("/",(req,res)=>{
    res.end("欢迎访问")
})

module.exports =  router