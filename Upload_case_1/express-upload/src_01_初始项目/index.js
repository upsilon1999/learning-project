//引入express服务
const express = require("express")
const path = require("path")
const multiparty = require("multiparty")
const fse = require("fs-extra")
const cors = require("cors")
const bodyParser = require("body-parser")

//引入路由
const router = require('./router/index') 
//创建express实例
const app = express()

app.use(bodyParser.json())

// 这个全局中间件一旦开启，路由就不能直接访问
//原因后续说明
// app.use(cors)


//注册路由
app.use("/",router)

app.listen(3000,()=>{
    console.log("3000端口正在被监听");
})