const express = require("express")
const router = express.Router()

router.get("/",(req,res)=>{
    console.log("正在被访问");
    res.end("欢迎访问")
})

module.exports =  router