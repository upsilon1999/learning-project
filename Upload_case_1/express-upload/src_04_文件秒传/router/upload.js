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

module.exports = router