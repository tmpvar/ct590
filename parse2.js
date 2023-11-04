const fs = require('fs')
const path = require('path')
const dcmjs = require('dcmjs')
const { mat4, vec3, vec4, mat3 } = require('gl-matrix')


const {
  DicomMetaDictionary,
  DicomDict,
  DicomMessage,
  ReadBufferStream
} = dcmjs.data;


const Max = Math.max
const Min = Math.min

const bounds = {
  lo: [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE,],
  hi: [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE,],
}
const imageTransform = mat4.create()
const tmpV4 = vec4.create()
const tmpV3 = vec3.create()
function TransformImageCorner(out, x, y, mat) {
  vec4.set(tmpV4, x, y, 0, 1.0)
  vec4.transformMat4(out, tmpV4, mat)
  out[0] /= out[3]
  out[1] /= out[3]
  out[2] /= out[3]
  out[3] = 1
  return out
}

function GrowBounds(pos) {
  bounds.lo[0] = Min(bounds.lo[0], pos[0])
  bounds.lo[1] = Min(bounds.lo[1], pos[1])
  bounds.lo[2] = Min(bounds.lo[2], pos[2])

  bounds.hi[0] = Max(bounds.lo[0], pos[0])
  bounds.hi[1] = Max(bounds.lo[1], pos[1])
  bounds.hi[2] = Max(bounds.lo[2], pos[2])
}

function DebugMat4(m) {
  console.log(m[0].toFixed(2), m[4].toFixed(2),  m[8].toFixed(2),  m[12].toFixed(2))
  console.log(m[1].toFixed(2), m[5].toFixed(2),  m[9].toFixed(2),  m[13].toFixed(2))
  console.log(m[2].toFixed(2), m[6].toFixed(2), m[10].toFixed(2), m[14].toFixed(2))
  console.log(m[3].toFixed(2), m[7].toFixed(2), m[11].toFixed(2), m[15].toFixed(2))
}

const imageCorner = vec4.create()

const slices = []

for (var fileIndex = 8; fileIndex < 390; fileIndex++) {
  var dirFile = `E:\\data\\IMAGE\\1593844\\20150614\\I${(fileIndex).toString().padStart(7, '0')}`

  const arrayBuffer = fs.readFileSync(dirFile).buffer
  const dicomDict = DicomMessage.readFile(arrayBuffer);


  const dataset = DicomMetaDictionary.naturalizeDataset(dicomDict.dict);
  if (fileIndex == 8) {
    console.log(dataset)
  }

  // console.log(fileIndex)
  // console.log('  position', dataset.ImagePositionPatient)
  // console.log('  orientation', dataset.ImageOrientationPatient)
  // console.log('  pixelSpacing', dataset.PixelSpacing)
  // console.log('  dims', dataset.Rows, dataset.Columns)
  // const width = dataset.Columns
  // const height = dataset.Rows
  // console.log(dataset)
  // console.log((dataset.PixelData[0].byteLength / 2) / width)

  {
    // https://dicom.innolitics.com/ciods/rt-dose/image-plane/00200037
    //
    // const delta = dataset.PixelSpacing
    const delta = [1, 1]
    const orientation = dataset.ImageOrientationPatient
    const S = dataset.ImagePositionPatient
    const X = [
      orientation[0],
      orientation[1],
      orientation[2],
    ]

    const Y = [
      orientation[3],
      orientation[4],
      orientation[5],
    ]


    // see: https://gist.github.com/agirault/60a72bdaea4a2126ecd08912137fe641
    const Z = vec3.cross(tmpV3, X, Y)


    // row major
    mat4.set(
      imageTransform,
      X[0] * delta[0],
      X[1] * delta[0],
      X[2] * delta[0],
      0,

      Y[0] * delta[1],
      Y[1] * delta[1],
      Y[2] * delta[1],
      0,

      Z[0],
      Z[1],
      Z[2],
      0.0,

      S[0],
      S[1],
      S[2],
      1.0
    )
  }

  let slice = {
    dims: [dataset.Rows, dataset.Columns],
    transform: mat4.copy(mat4.create(), imageTransform),
    data: new Uint16Array(dataset.PixelData[0]),
  }

  slices.push(slice)


  GrowBounds(TransformImageCorner(imageCorner, 0, 0, imageTransform))
  GrowBounds(TransformImageCorner(imageCorner, slice.dims[0], 0, imageTransform))
  GrowBounds(TransformImageCorner(imageCorner, 0, slice.dims[1], imageTransform))
  GrowBounds(TransformImageCorner(imageCorner, slice.dims[0], slice.dims[1], imageTransform))
}

console.log(bounds)
