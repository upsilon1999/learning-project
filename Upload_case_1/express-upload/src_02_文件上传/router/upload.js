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




module.exports = router