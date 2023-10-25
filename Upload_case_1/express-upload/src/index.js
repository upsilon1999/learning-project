//引入express服务
const express = require("express")

const cors = require("cors")
const bodyParser = require("body-parser")

//引入路由
const router = require('./router/index') 
const uploadRouter = require('./router/upload')
//创建express实例
const app = express()

app.use(bodyParser.json())

// 这个全局中间件一旦开启，路由就不能直接访问
//原因后续说明
// app.use(cors)
// 使用cors中间件，并传入一个选项对象
app.use(cors({
    // 设置请求白名单允许跨域请求
    origin: 'http://127.0.0.1:5173' // 指定允许的来源
}));

  

//注册路由
app.use("/",router)
app.use("/upload",uploadRouter)

app.listen(3000,()=>{
    console.log("3000端口正在被监听");
    console.log(__dirname);
})