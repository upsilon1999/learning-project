<script setup>
// 文件分片的函数

/**
 * 文件分片的核心是用Blob对象的slice方法，
 * 上一步获取到选择的文件是一个File对象，它是继承于Blob
 * 所以我们就可以用slice方法对文件进行分片，语法如下
 * let blob = instanceOfBlob.slice([start [, end [, contentType]]]};
 * 
 * start和end代表Blob里的下标，表示被拷贝进新的 Blob 的字节的起始位置和结束位置。
 * contentType 会给新的 Blob 赋予一个新的文档类型
 * 
 * 1GB = 1024MB = 1024*1024KB = 1024*1024*1024B
 */
//分块大小
const CHUNK_SIZE = 1024*1024 //1MB
/**
 * @param file是文件对象
 */
 const createFileChunks = (file) => {
  // 文件分块数组
  const fileChunkList = []
  //下标，知道文件分块位置
  let cur = 0
  /**
   * 如果分块位置小于文件大小，代表还能分块
   * CHUNK_SIZE 每块的大小，常量控制分块大小
   */
  while (cur < file.size) {
    const fileChunk = file.slice(cur, cur + CHUNK_SIZE)
    fileChunkList.push(fileChunk)
    cur += CHUNK_SIZE // CHUNK_SIZE为分片的大小
  }
  return fileChunkList
}

const handleUpload = (e)=>{
  const files = e.target.files
 
  // 如果没有拿到，方法终止
  if(!files) return

  //反之，继续执行
  console.log(files[0]);

  //执行分块函数
  const fileChunkList = createFileChunks(files[0])
  console.log(fileChunkList);
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
