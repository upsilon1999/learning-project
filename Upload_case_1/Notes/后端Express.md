# 后端Express

## 创建项目

```sh
# 新建一个文件夹，进入文件夹后执行
npm init
npm i express
# 没有采用脚手架，因为我们目前用不到
```

>安装大文件上传所需依赖

```sh
# 处理post请求
npm i body-parser
```

```sh
#body-parser包只能处理post请求,不能上传图片。 
#multiparty包post请求和文件都可以处理
npm i multiparty
```

```sh
#fs-extra是fs的一个扩展，提供了非常多的便利API，并且继承了fs所有方法和为fs方法添加了promise的支持
npm i fs-extra
```

```sh
#cors处理跨域问题
npm i cors
```

```sh
#nodemon 开发环境下nodeJs热重启
npm i nodemon
# 把项目的启动方式有node xxx改为 nodemon xxx
```

## 初始项目

>文件目录

入口文件`src/index.js`

```js
//引入express服务
const express = require("express")
//这些都还没有用到，只是引入看看
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
```

路由配置

`router/index.js`

```js
const express = require("express")
const router = express.Router()

router.get("/",(req,res)=>{
    res.end("欢迎访问")
})

module.exports =  router
```

## 上传接口

后端我们处理文件时需要用到 `multiparty` 这个工具，所以也是得先安装，然后再引入它。

我们在处理每个上传的分片的时候，应该先将它们临时存放到服务器的一个地方，方便我们合并的时候再去读取。为了区分不同文件的分片，我们就用文件对应的那个hash为文件夹的名称，将这个文件的所有分片放到这个文件夹中。

>入口文件

```js
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
```

>上传接口

```js
const express = require("express")
const path = require("path")
const fse = require("fs-extra")
const multiparty = require("multiparty")


//设置一个upload文件夹
// __dirname,在所有情况下,该变量都表示当前运行的js文件所在的目录,它是一个绝对路径。
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');

const router = express.Router()

router.post("/",(req,res)=>{
    //构造multiparty的表单对象
    const form =new multiparty.Form()

    /**
     * form对象上的parse方法
     * form.parse(①，②)
     * ①是需要去解析的请求报文对象
     * ②是回调函数
     * 
     * (err,fileds,files)=>{}
     * err:错误对象
     * fileds:包含我们传递的除文件块外的文件其余信息
     * files:我们上传的文件块，他被临时存放在根目录
     * 
     * fields和files是自动对前端的请求体解析得到的，
     * 前端请求体内容除了文件块外都会在fileds中
     * 文件块会在files中，如果解析不到文件块，files就会是个空对象
     */
    //async 异步的原因是下面有个创建文件夹的操作时异步的用到了await
    form.parse(req,async (err,fields,files)=>{
        if(err){
            res.status(401).json({
                ok:"false",
                msg:"上传失败，请重新上传"
            })
            return
        }
        console.log(fields);
        console.log(files);

        // 获取文件的hash值
        //从打印结果可知 filehash是数组
        const fileHash =fields["fileHash"][0]

        const chunkHash = fields["chunkHash"][0]

        //临时存放目录
        //我们用文件的hash值当作文件切片的存放目录
        const chunkDir = path.resolve(UPLOAD_DIR,fileHash)

        // 如果目录不存在就创建目录
        if(!fse.existsSync(chunkDir)){
            //创建文件夹
            //由于创建文件夹的操作是异步的，所以需要使用async...await
            await fse.mkdir(chunkDir)
        }

        //打印files可以知道文件块的临时存在位置
        //拿到临时存在的路径
        const oldPath = files["chunkData"][0]["path"]

        //将切片放到这个文件夹里面
        fse.move(oldPath,path.resolve(chunkDir,chunkHash))
        //将切片放到这个文件夹下
        res.status(200).json({
            ok:"true",
            msg:"上传成功"
        })
        return
    })
})

module.exports = router
```

## 文件合并

在之前已经可以将所有的切片上传到服务器并存储到对应的目录里面去了，合并的时候需要从对应的文件夹中获取所有的切片，然后利用文件的读写操作，就可以实现文件的合并了。合并完成之后，我们将生成的文件以hash值命名存放到对应的位置就可以了。

```js
// 提取文件后缀名
const extractExt = filename => {
	return filename.slice(filename.lastIndexOf('.'), filename.length)
}

//合并分块
router.post("/merge",async (req,res)=>{
    //拿到前端参数
    const {fileHash,fileName,size} = req.body

    //如果服务器上已经有对应文件了就不用合并
    // 完整的文件路径
    const filePath = path.resolve(UPLOAD_DIR,fileHash + extractExt(fileName))
    console.log(filePath);

    //判断文件是否存在，存在就不用合并了
    /**
     * 坑 如果使用 fse.exists(filePath) 会恒定为true
     * 注意使用的方法是 existsSync
     */
    if(fse.existsSync(filePath)){
        console.log("文件已存在,无需合并");
        //给前端反馈合并成功，实际上因为文件存在所以不用执行合并操作
        res.status(200).json({
            ok:"true",
            msg:"文件已存在,无需合并"
        })
        return
    }

    //如果不存在该文件才去合并，需要去读取文件
    const chunkDir = path.resolve(UPLOAD_DIR,fileHash)

    //如果合并的时候发现临时文件不存在，应该让用户重新上传
    if(!fse.existsSync(chunkDir)){
        res.status(401).json({
            ok:"false",
            msg:"合并失败，请重新上传"
        })
        return
    }

    /**
     * 合并操作
     * ①读取所有的文件块
     * ②知道文件块的序列，根据我们文件块的命名规则 hash-索引
     * ③合并文件
     */
    const chunkPaths = await fse.readdir(chunkDir)
    console.log(chunkPaths);
    //文件序列排序，否则合并的时候组合出来的不一定是原文件
    chunkPaths.sort((a,b)=>{
        return a.split("-")[1] - b.split("-")[1]
    })


    //遍历路径，读取文件流进行合并
    chunkPaths.map((chunkName,index)=>{
        console.log(chunkName);
        const chunkPath = path.resolve(chunkDir,chunkName)

        //读文件
        const readStream = fse.createReadStream(chunkPath)

        //写文件
        const writeStream = fse.createWriteStream(
            //文件名
            filePath,
            {
                //写入文件的什么位置
                start:index*size,
                end:(index+1)*size
            }
        )

       //管道：把读的内容放到写的流里面
       readStream.pipe(writeStream)

       //注册读取完的事件，读完后移除临时切片
       readStream.on("end",async ()=>{
        await fse.unlink(chunkPath)
       })
    })

    res.status(200).json({
        ok:"true",
        msg:"合并成功"
    })
})
```

由于要等到所有临时切片都合并完成后再移除临时切片文件夹，所以要进一步处理

```js
// 提取文件后缀名
const extractExt = filename => {
	return filename.slice(filename.lastIndexOf('.'), filename.length)
}

//合并分块
router.post("/merge",async (req,res)=>{
    //拿到前端参数
    const {fileHash,fileName,size} = req.body

    //如果服务器上已经有对应文件了就不用合并
    // 完整的文件路径
    const filePath = path.resolve(UPLOAD_DIR,fileHash + extractExt(fileName))
    console.log(filePath);

    //判断文件是否存在，存在就不用合并了
    /**
     * 坑 如果使用 fse.exists(filePath) 会恒定为true
     * 注意使用的方法是 existsSync
     */
    if(fse.existsSync(filePath)){
        console.log("文件已存在,无需合并");
        //给前端反馈合并成功，实际上因为文件存在所以不用执行合并操作
        res.status(200).json({
            ok:"true",
            msg:"文件已存在,无需合并"
        })
        return
    }

    //如果不存在该文件才去合并，需要去读取文件
    const chunkDir = path.resolve(UPLOAD_DIR,fileHash)

    //如果合并的时候发现临时文件不存在，应该让用户重新上传
    if(!fse.existsSync(chunkDir)){
        res.status(401).json({
            ok:"false",
            msg:"合并失败，请重新上传"
        })
        return
    }

    /**
     * 合并操作
     * ①读取所有的文件块
     * ②知道文件块的序列，根据我们文件块的命名规则 hash-索引
     * ③合并文件
     */
    const chunkPaths = await fse.readdir(chunkDir)
    console.log(chunkPaths);
    //文件序列排序，否则合并的时候组合出来的不一定是原文件
    chunkPaths.sort((a,b)=>{
        return a.split("-")[1] - b.split("-")[1]
    })


    //遍历路径，读取文件流进行合并
   const list =  chunkPaths.map((chunkName,index)=>{
        return new Promise((resolve)=>{
            console.log(chunkName);
            const chunkPath = path.resolve(chunkDir,chunkName)
    
            //读文件
            const readStream = fse.createReadStream(chunkPath)
    
            //写文件
            const writeStream = fse.createWriteStream(
                //文件名
                filePath,
                {
                    //写入文件的什么位置
                    start:index*size,
                    end:(index+1)*size
                }
            )
    
           //管道：把读的内容放到写的流里面
           readStream.pipe(writeStream)
    
           //注册读取完的事件，读完后移除临时切片
           readStream.on("end",async ()=>{
            await fse.unlink(chunkPath)
            resolve()
           })
        })
       
    })

    // 等到list里面的移除临时切片的异步操作都完成了
    await Promise.all(list)

    //再删掉临时切片文件夹
    await fse.remove(chunkDir)

    res.status(200).json({
        ok:"true",
        msg:"合并成功"
    })
})
```

到这里，我们就已经实现了大文件的分片上传的基本功能了，但是我们没有考虑到如果上传相同的文件的情况，而且如果中间网络断了，我们就得重新上传所有的分片，这些情况在大文件上传中也都需要考虑到，下面，我们就来解决下这两个问题。

## 文件秒传

```js
// 提取文件后缀名
const extractExt = filename => {
	return filename.slice(filename.lastIndexOf('.'), filename.length)
}

//秒传校验
router.post("/verify",(req,res)=>{
    const {fileHash,fileName} = req.body
    console.log(fileName)
    console.log(fileHash)

    //判断服务器是否有对应文件
    const filePath = path.resolve(UPLOAD_DIR,fileHash + extractExt(fileName))

    
    if(fse.existsSync(filePath)){
        //如果文件存在，就不用上传
        res.status(200).json({
            ok:"true",
            data:{
                shouldUpload:false
            }
        })
    }else{
        //如果文件不存在，需要上传
        res.status(200).json({
            ok:"true",
            data:{
                shouldUpload:true
            }
        })
    }  
})
```

完成上面的步骤后，当我们再上传相同的文件，即使改了文件名，也会提示我们秒传成功了，因为服务器上已经有对应的那个文件了。

上面我们解决了重复上传的文件，但是对于网络中断需要重新上传的问题没有解决，那该如何解决呢？

如果我们之前已经上传了一部分分片了，我们只需要再上传之前拿到这部分分片，然后再过滤掉是不是就可以避免去重复上传这些分片了，也就是只需要上传那些上传失败的分片，所以，再上传之前还得加一个判断。

## 断点续传

对上传前的校验进行一个检验临时切片，将需要断点续传的文件的已经有的临时切片做一个反馈

```js
//秒传校验
router.post("/verify",async (req,res)=>{
    const {fileHash,fileName} = req.body
    console.log(fileName)
    console.log(fileHash)

    //判断服务器是否有对应文件
    const filePath = path.resolve(UPLOAD_DIR,fileHash + extractExt(fileName))

    //返回服务器上已经上传成功的切片
    const chunkDir = path.resolve(UPLOAD_DIR,fileHash)
    const chunkPaths = []
    // 如果存在对应的临时文件夹,才去读取
    if(fse.existsSync(chunkDir)){
        chunkPaths = await fse.readdir(chunkDir)
    }
   
    console.log(chunkPaths);
    
    if(fse.existsSync(filePath)){
        //如果文件存在，就不用上传
        res.status(200).json({
            ok:"true",
            data:{
                shouldUpload:false
            }
        })
    }else{
        //如果文件不存在，需要上传
        res.status(200).json({
            ok:"true",
            data:{
                shouldUpload:true,
                // 返回服务器上已经存在的切片
                existChunk:chunkPaths
            }
        })
    } 
})
```

>完整的upload路由

```js
const express = require("express")
const path = require("path")
const fse = require("fs-extra")
const multiparty = require("multiparty")


//设置一个upload文件夹
// __dirname,在所有情况下,该变量都表示当前运行的js文件所在的目录,它是一个绝对路径。
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');

const router = express.Router()

//分块上传
router.post("/",(req,res)=>{
    //构造multiparty的表单对象
    const form =new multiparty.Form()

    /**
     * form对象上的parse方法
     * form.parse(①，②)
     * ①是需要去解析的请求报文对象
     * ②是回调函数
     * 
     * (err,fileds,files)=>{}
     * err:错误对象
     * fileds:包含我们传递的除文件块外的文件其余信息
     * files:我们上传的文件块，他被临时存放在根目录
     * 
     * fields和files是自动对前端的请求体解析得到的，
     * 前端请求体内容除了文件块外都会在fileds中
     * 文件块会在files中，如果解析不到文件块，files就会是个空对象
     */
    //async 异步的原因是下面有个创建文件夹的操作时异步的用到了await
    form.parse(req,async (err,fields,files)=>{
        if(err){
            res.status(401).json({
                ok:"false",
                msg:"上传失败，请重新上传"
            })
            return
        }
        // console.log(fields);
        // console.log(files);

        // 获取文件的hash值
        //从打印结果可知 filehash是数组
        const fileHash =fields["fileHash"][0]

        const chunkHash = fields["chunkHash"][0]

        //临时存放目录
        //我们用文件的hash值当作文件切片的存放目录
        const chunkDir = path.resolve(UPLOAD_DIR,fileHash)

        // 如果目录不存在就创建目录
        if(!fse.existsSync(chunkDir)){
            //创建文件夹
            //由于创建文件夹的操作是异步的，所以需要使用async...await
            await fse.mkdir(chunkDir)
        }

        //打印files可以知道文件块的临时存在位置
        //拿到临时存在的路径
        const oldPath = files["chunkData"][0]["path"]

        //将切片放到这个文件夹里面
        fse.move(oldPath,path.resolve(chunkDir,chunkHash))
        //将切片放到这个文件夹下
        res.status(200).json({
            ok:"true",
            msg:"上传成功"
        })
        return
    })
})


// 提取文件后缀名
const extractExt = filename => {
	return filename.slice(filename.lastIndexOf('.'), filename.length)
}

//合并分块
router.post("/merge",async (req,res)=>{
    //拿到前端参数
    const {fileHash,fileName,size} = req.body

    //如果服务器上已经有对应文件了就不用合并
    // 完整的文件路径
    const filePath = path.resolve(UPLOAD_DIR,fileHash + extractExt(fileName))
    console.log(filePath);

    //判断文件是否存在，存在就不用合并了
    /**
     * 坑 如果使用 fse.exists(filePath) 会恒定为true
     * 注意使用的方法是 existsSync
     */
    if(fse.existsSync(filePath)){
        console.log("文件已存在,无需合并");
        //给前端反馈合并成功，实际上因为文件存在所以不用执行合并操作
        res.status(200).json({
            ok:"true",
            msg:"文件已存在,无需合并"
        })
        return
    }

    //如果不存在该文件才去合并，需要去读取文件
    const chunkDir = path.resolve(UPLOAD_DIR,fileHash)

    //如果合并的时候发现临时文件不存在，应该让用户重新上传
    if(!fse.existsSync(chunkDir)){
        res.status(401).json({
            ok:"false",
            msg:"合并失败，请重新上传"
        })
        return
    }

    /**
     * 合并操作
     * ①读取所有的文件块
     * ②知道文件块的序列，根据我们文件块的命名规则 hash-索引
     * ③合并文件
     */
    const chunkPaths = await fse.readdir(chunkDir)
    console.log(chunkPaths);
    //文件序列排序，否则合并的时候组合出来的不一定是原文件
    chunkPaths.sort((a,b)=>{
        return a.split("-")[1] - b.split("-")[1]
    })


    //遍历路径，读取文件流进行合并
   const list =  chunkPaths.map((chunkName,index)=>{
        return new Promise((resolve)=>{
            console.log(chunkName);
            const chunkPath = path.resolve(chunkDir,chunkName)
    
            //读文件
            const readStream = fse.createReadStream(chunkPath)
    
            //写文件
            const writeStream = fse.createWriteStream(
                //文件名
                filePath,
                {
                    //写入文件的什么位置
                    start:index*size,
                    end:(index+1)*size
                }
            )
    
           //管道：把读的内容放到写的流里面
           readStream.pipe(writeStream)
    
           //注册读取完的事件，读完后移除临时切片
           readStream.on("end",async ()=>{
            await fse.unlink(chunkPath)
            resolve()
           })
        })
       
    })

    // 等到list里面的移除临时切片的异步操作都完成了
    await Promise.all(list)

    //再删掉临时切片文件夹
    await fse.remove(chunkDir)

    res.status(200).json({
        ok:"true",
        msg:"合并成功"
    })
})


//秒传校验
router.post("/verify",async (req,res)=>{
    const {fileHash,fileName} = req.body
    console.log(fileName)
    console.log(fileHash)

    //判断服务器是否有对应文件
    const filePath = path.resolve(UPLOAD_DIR,fileHash + extractExt(fileName))

    //返回服务器上已经上传成功的切片
    const chunkDir = path.resolve(UPLOAD_DIR,fileHash)
    const chunkPaths = []
    // 如果存在对应的临时文件夹,才去读取
    if(fse.existsSync(chunkDir)){
        chunkPaths = await fse.readdir(chunkDir)
    }
   
    console.log(chunkPaths);
    
    if(fse.existsSync(filePath)){
        //如果文件存在，就不用上传
        res.status(200).json({
            ok:"true",
            data:{
                shouldUpload:false
            }
        })
    }else{
        //如果文件不存在，需要上传
        res.status(200).json({
            ok:"true",
            data:{
                shouldUpload:true,
                // 返回服务器上已经存在的切片
                existChunk:chunkPaths
            }
        })
    }

    
})

module.exports = router
```



