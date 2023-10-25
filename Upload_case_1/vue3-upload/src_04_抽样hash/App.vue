<script setup>
//引入spark-MD5包
import sparkMD5 from "spark-md5"

//分块大小
const CHUNK_SIZE = 1024*1024 
/**
 * 计算文件的hash值，计算的时候并不是根据所用的切片的内容去计算的，那样会很耗时间，我们采取下面的策略去计算：
 * 1. 第一个和最后一个切片的内容全部参与计算
 * 2. 中间剩余的切片我们分别在前面、后面和中间取2个字节参与计算
 * 这样做会节省计算hash的时间
 */
/**
 * @param fileChunks 切片数组
 */
/*
  之所以使用promise是因为spark-md5的计算是异步的，
  而我们上传文件是同步的
*/
 const calculateHash = async (fileChunks) => {
  //spark-md5的使用推荐官方文档
  return new Promise(resolve => {

    const spark = new sparkMD5.ArrayBuffer()

    //1.第一个和最后一个切片全部参与计算
    //2.中间的切片只计算前两个字节、中间两个字节、最后两个字节
    //存储所有参与计算的切片
    const targets = []

    fileChunks.forEach((chunk, index) => {
      if (index === 0 || index === fileChunks.length - 1) {
        // 1. 第一个和最后一个切片的内容全部参与计算
        targets.push(chunk)
      } else {
        // 2. 中间剩余的切片我们分别在前面、后面和中间取2个字节参与计算
        // 前面的2字节
        targets.push(chunk.slice(0, 2))
        // 中间的2字节
        targets.push(chunk.slice(CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 2))
        // 后面的2字节
        targets.push(chunk.slice(CHUNK_SIZE - 2, CHUNK_SIZE))
      }
    })

    //声明一个读取对象
    const reader = new FileReader()
    reader.readAsArrayBuffer(new Blob(targets))
    reader.onload = (e) => {
      spark.append(e.target.result)
      resolve(spark.end())
    }
  })
}




const createFileChunks = (file) => {
  const fileChunkList = []
  let cur = 0
  while (cur < file.size) {
    const fileChunk = file.slice(cur, cur + CHUNK_SIZE)
    fileChunkList.push(fileChunk)
    cur += CHUNK_SIZE 
  }
  return fileChunkList
}

const handleUpload = async (e)=>{
  const files = e.target.files
  // 如果没有拿到，方法终止
  if(!files) return
  //反之，继续执行
  //执行分块函数
  const fileChunkList = createFileChunks(files[0])

  //计算文件hash值
  //不使用await将拿到一个promise对象
  const hashVal =await calculateHash(fileChunkList)
  console.log(hashVal);
}

</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <!-- 监听input框，通过绑定事件获取文件 -->
    <input type="file" @change="handleUpload">
  </div>
</template>

<style scoped>

</style>
