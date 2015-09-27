var path = require('path');
var async = require('async');
var dicom = require('dicomjs');
var diff = require('deep-diff');
var mat3 = require('gl-mat3');
var vec3 = require('gl-vec3');
var ndarray = require('ndarray');
var surfaceNets = require('surface-nets');
var stl = require('stl')
var files = [];
var fs = require('fs');

var THRESHOLD = 1200;

for (var i = 8; i<71; i++) {
  var k = i+'';
  while (k.length < 7) {
    k = '0' + k;
  }
  files.push('I' + k);

}

var bounds = [
  [Infinity, Infinity, Infinity],
  [-Infinity, -Infinity, -Infinity]
];


function exp(a) {
  return a.toExponential();
}


async.mapSeries(files, parseFile, function(e, r) {
  console.error(bounds)

  // TODO: scale this better.
  var dimensions = [
    Math.round(bounds[1][0] - bounds[0][0]),
    Math.round(bounds[1][1] - bounds[0][1]),
    Math.round(bounds[1][2] - bounds[0][2]),
  ];
  console.error('dimensions', dimensions)

  // TODO: handle other # of bits stored

  var volume = ndarray(new Uint16Array(dimensions[0] * dimensions[1] * dimensions[2]), dimensions)
  var lb = bounds[0];

  function readPositionFromSlice(out, d, p) {
    var pxs = d.pixelSpacing;
    var dir = d.direction;
    var w = d.voxelColumns;
    var h = d.voxelRows;


    // compute the current x and y
    var vec = [
      (p % w) * pxs[0],
      (Math.floor(p / w)) * pxs[1],
      0
    ];

    // now stuff the value into the volume at the correct location
    // dataset.positionImagePatient?
    var volumePosition = [0, 0, 0];
    vec3.multiply(volumePosition, vec, dir);

    var start = d.positionImagePatient;

    out[0] = Math.round((lb[0] - start[0]) + volumePosition[0])
    out[1] = Math.round((lb[1] - start[1]) + volumePosition[1])
    out[2] = Math.round((lb[2] - start[2]) + volumePosition[2])
    return
  }

  var tmp = [0, 0, 0];

  // run through each slice and apply the voxels to the volume
  r.forEach(function(d, sliceIndex) {

    var step = (d.bitsStored/8);
    var l = d.pixelData.length;

    for (var i=0; i<l; i+=step) {
      // TODO: handle endianness
      var v = Math.max(0, d.pixelData.readInt16LE(i))

      var p = i/step;

      readPositionFromSlice(tmp, d, p);
      volume.set(tmp[0], tmp[1], sliceIndex, v);

      if (v >= THRESHOLD && sliceIndex < r.length-1) {
        var nextSlice = r[sliceIndex+1]

      //   var tv = d.pixelData.readInt16LE(i);
      //   readPositionFromSlice(tmp, nextSlice, p);

        var nextSliceZ = Math.round((lb[2] - d.positionImagePatient[2]));// + nextSlice.positionImagePatient[2])
        var nextSliceDirection = (lb[2] - nextSlice.positionImagePatient[2]) - nextSliceZ;

      //   // // TODO: don't assume that the next slice has the same planar orientation
      //   // // TODO: don't assume that the slices go in any particular direction (z is safe, but which way?)
      //   // var interp = (v - tv)/3;
      //   var interp = 0;
      //   volume.set(tmp[0], tmp[1], tmp[2] + 1, v - interp)
      //   volume.set(tmp[0], tmp[1], tmp[2] + 2, v - interp * 2)
      }
    }
  })

  var output = {
    description: "my elbow",
    facets: []
  }

  var nets = surfaceNets(volume, THRESHOLD);


  // var stream = fs.createWriteStream('/Users/tmpvar/Desktop/elbow-' + Date.now() + '.stl')
  process.stdout.write('solid elbow\n');

  nets.cells.forEach(function(cell) {

    process.stdout.write([
      'facet',
        'outer loop',
        'vertex ' + nets.positions[cell[0]].map(exp).join(' '),
        'vertex ' + nets.positions[cell[1]].map(exp).join(' '),
        'vertex ' + nets.positions[cell[2]].map(exp).join(' '),
        'endloop',
        'endfacet',
        ''
    ].join('\n'))
  })

  process.stdout.write('endsolid');

})

var last = {};

function parseFile(file, cb) {
  dicom.parseFile(path.join('/Users/tmpvar/Sync/broken-elbow/IMAGE/1593844/20150614/', file), function(e, d) {
    if (e) throw e;
    // console.error(d);
// console.error(d.pixelData)
    console.error('\n\n---------- %s -----------', file)
    // console.error(Object.keys(d.dataset).join(', '))
    // console.error(d.dataset['00431031'])
    // console.error(d.dataset['00280030'])
    // console.error(d.dataset['00201041'])
    // console.error(diff(last, d.dataset))
    // last = d.dataset;

    var dataset = {
      file: file
    }
// console.error(d.dataset)
    datasetKeys.forEach(function(a) {
      var o = d.dataset[a[0]];
      if (o) {

        dataset[a[1]] = o.value.trim ? o.value.trim() : o.value;
      }
    })

    dataset.pixelData = d.pixelData;

    var pos = dataset.positionImagePatient;

    bounds[0][0] = Math.min(pos[0], bounds[0][0]);
    bounds[0][1] = Math.min(pos[1], bounds[0][1]);
    bounds[0][2] = Math.min(pos[2], bounds[0][2]);
    bounds[1][0] = Math.max(pos[0], bounds[1][0]);
    bounds[1][1] = Math.max(pos[1], bounds[1][1]);
    bounds[1][2] = Math.max(pos[2], bounds[1][2]);

    var rot = dataset.orientationImagePatient;
    dataset.rotation = [
      rot[0], rot[3], 0,
      rot[1], rot[4], 0,
      rot[2], rot[5], 0,
    ];

    var vec = [
      dataset.voxelColumns * dataset.pixelSpacing[0],
      dataset.voxelRows * dataset.pixelSpacing[1],
      0
    ];

    var rotated = vec3.transformMat3([], vec, dataset.rotation)

    bounds[0][0] = Math.min(rotated[0], bounds[0][0]);
    bounds[0][1] = Math.min(rotated[1], bounds[0][1]);
    bounds[0][2] = Math.min(rotated[2], bounds[0][2]);
    bounds[1][0] = Math.max(rotated[0], bounds[1][0]);
    bounds[1][1] = Math.max(rotated[1], bounds[1][1]);
    bounds[1][2] = Math.max(rotated[2], bounds[1][2]);

    dataset.direction = [0, 0, 0];
    vec3.normalize(dataset.direction, rotated);
    // vec3.normalize(dataset.direction, vec3.transformMat3([], vec, [
    //   rot[0], rot[1], rot[2],
    //   rot[3], rot[4], rot[5],
    //   0, 0, 0
    // ]));

    console.error('direction', dataset.direction)
    console.error('start', pos)
    console.error('vec', vec)

    console.error('rotated', rotated)
    console.error('rotated2', vec3.transformMat3([], vec, [
      rot[0], rot[1], rot[2],
      rot[3], rot[4], rot[5],
      0, 0, 0
    ]))

    console.error('orientation', dataset.orientationImagePatient)
    console.error('position', dataset.positionImagePatient)
    // console.error('pixelSpacing', dataset.pixelSpacing)
    // console.error('diameter', dataset.reconstructDiameter)
    return cb(null, dataset)
  })
}


var datasetKeys = [
  ['00080008', 'imageType', 'Image Type',  '1', 'Image identification characteristics. See C.8.2.1.1.1 for specialization.'],
  ['00280002', 'samplesPerPixel', 'Samples per Pixel', '1', 'Number of samples (planes) in this image. See C.8.2.1.1.2 for specialization.'],
  ['00280004', 'photometricInterpretation', 'Photometric Interpretation', '1', 'Specifies the intended interpretation of the pixel data. See C.8.2.1.1.3 for specialization.'],
  ['00280100', 'bitsAllocated', 'Bits Allocated', '1',  'Number of bits allocated for each pixel sample. Each sample shall have the same number of bits allocated. See C.8.2.1.1.4 for specialization].'],
  ['00280101', 'bitsStored', 'Bits Stored', '1', 'Number of bits stored for each pixel sample. Each sample shall have the same number of bits stored. See C.8.2.1.1.5 for specialization.'],
  ['00280102', 'highBit', 'High Bit', '1', 'Most significant bit for pixel sample data. Each sample shall have the same high bit. See C.8.2.1.1.6 for specialization].'],
  ['00281052', 'rescaleIntercept', 'Rescale Intercept', 'T', '0028he value b in relationship between stored values (SV) and Hounsfield (HU). HU = m*SV+]b'],
  ['00281053', 'rescaleSlope', 'Rescale Slope', '1', 'm in the equation specified in Rescale Intercept (0028,1052).'],
  ['00180060', 'kvp', 'KVP', '2', 'Peak kilo voltage output of the x-ray generator used'],
  ['00200012', 'aquisitionNumber', 'Acquisition Number', '2', 'A number identifying the single continuous gathering of data over a period of time which resulted in this image'],
  ['00180022', 'scanOptions', 'Scan Options', '3', 'Parameters of scanning sequence.'],
  ['00180090', 'collectionDiameter', 'Data Collection Diameter', '3', 'The diameter in mm of the region over which data were collected'],
  ['00181100', 'reconstructDiameter', 'Reconstruction Diameter', '3', 'Diameter in mm of the region from within which data were used in creating the reconstruction of the image. Data may exist outside this region and portions of the patient may exist outside this region.'],
  ['00181110', 'distanceSourceDetector', 'Distance Source to Detector', '3', 'Distance in mm from source to detector center'],
  ['00181111', 'distanceSourcePatient', 'Distance Source to Patient', '3', 'Distance in mm from source to isocenter (center of field of view)'],
  ['00181120', 'tilt', 'Gantry/Detector Tilt', '3', 'Nominal angle of tilt in degrees of the scanning gantry. Not intended for mathematical computations.'],
  ['00181130', 'tableHeight', 'Table Height', '3', 'The distance in mm of the top of the patient table to the center of rotation; below the center is positive.'],
  ['00181140', 'rotationDirection', 'Rotation Direction', '3', 'Direction of rotation of the source when relevant, about nearest principal axis of equipment. Enumerated Values: CW = clockwise CC = counter clockwise'],
  ['00181150', 'exposureTime', 'Exposure Time', '3', 'Time of x-ray exposure in msec'],
  ['00181151', 'tubeCurrent', 'X-ray Tube Current', '3', 'X-ray Tube Current in mA.'],
  ['00181152', 'exposureMAs', 'Exposure', '3', 'The exposure expressed in mAs, for example calculated from Exposure Time and X-ray Tube Current.'],
  ['00181153', 'exposureUAs', 'Exposure in µAs', '3', 'The exposure expressed in µAs, for example calculated from Exposure Time and X-ray Tube Current.'],
  ['00181160', 'filterType', 'Filter Type', '3', 'Label for the type of filter inserted into the x-ray beam.'],
  ['00181170', 'generatorPower', 'Generator Power', '3', 'Power in kW to the x-ray generator.'],
  ['00181190', 'focalSpot', 'Focal Spot', '3', 'Size of the focal spot in mm. For devices with variable focal spot or multiple focal spots, small dimension followed by large dimension.'],
  ['00181210', 'convolutionKernel', 'Convolution Kernel', '3', 'A label describing the convolution kernel or algorithm used to reconstruct the data]'],

  // voxel stuff
  ['00280030', 'pixelSpacing', 'Pixel Spacing', '1', 'Physical distance in the patient between the center of each pixel, specified by a numeric pair - adjacent row spacing (delimiter) adjacent column spacing in mm.'],
  ['00200037', 'orientationImagePatient', 'Image Orientation (Patient)', '1', 'The direction cosines of the first row and the first column with respect to the patient. See C.7.6.2.1.1 for further explanation.'],
  ['00200032', 'positionImagePatient', 'Image Position (Patient)', '1', 'The x, y, and z coordinates of the upper left hand corner (center of the first voxel transmitted) of the image, in mm. See C.7.6.2.1.1 for further explanation.'],
  ['00180050', 'sliceThickness', 'Slice Thickness', '2', 'Nominal slice thickness, in mm.'],
  ['00201041', 'sliceLocation', 'Slice Location', '3', 'Relative position of exposure expressed in mm. C.7.6.2.1.2 for further explanation.'],
  ['00280010', 'voxelRows', 'Voxel Rows', '1', 'Number of voxels in the vertical direction in the frame.'],
  ['00280010', 'voxelColumns', 'Voxel Columns', '1', 'Number of voxels in the horizontal direction in the frame.'],
];
