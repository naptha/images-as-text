

function median(array){
    var sorted = [].slice.call(array, 0).sort(function(a, b){
        return a - b
    });
    return sorted[Math.floor(array.length/2)]
}


searchDirection = -1

process = function(img){
    var ctx = document.createElement('canvas').getContext('2d')
    // this is a port of the stroke width transform
    // algorithm using the jsfeat computer vision library
    // right now it's quite ugly and slow, and i've commented
    // out the entire second pass because for some unknown
    // reason it's orders of magnitude slower than the
    // rest of the process and does very little to improve
    // the quality of the result

    canvasWidth = img.naturalWidth
    canvasHeight = img.naturalHeight

    ctx.canvas.width = canvasWidth
    ctx.canvas.height = canvasHeight

    ctx.drawImage(img, 0, 0)

    img_u8 = new jsfeat.matrix_t(canvasWidth, canvasHeight, jsfeat.U8C1_t)

    img_gxgy = new jsfeat.matrix_t(canvasWidth, canvasHeight, jsfeat.S32C2_t);

    theta = new jsfeat.matrix_t(canvasWidth, canvasHeight, jsfeat.F32C1_t)

    swtMap = new jsfeat.matrix_t(canvasWidth, canvasHeight, jsfeat.U8C1_t)

    var INTFINITY = 0xff;

    for(var i = 0; i < swtMap.data.length; i++){
        swtMap.data[i] = INTFINITY; // this is close enough to infinity right
    }


    console.time("getting data")
    var imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
    console.timeEnd("getting data")

    console.time("to gray")
    // stat.start("grayscale");
    jsfeat.imgproc.grayscale(imageData.data, img_u8.data);
    // stat.stop("grayscale");

    console.timeEnd("to gray")
    var options = {
        blur_radius: 2,
        low_threshold: 20,
        high_threshold: 50  
    };
    console.time("sobel")
    jsfeat.imgproc.sobel_derivatives(img_u8, img_gxgy);
    
    console.timeEnd("sobel")

    var r = options.blur_radius|0;
    var kernel_size = (r+1) << 1;
    console.time("gaussian")
    jsfeat.imgproc.gaussian_blur(img_u8, img_u8, kernel_size, 0);
    console.timeEnd("gaussian")
    console.time("canny")
    jsfeat.imgproc.canny(img_u8, img_u8, options.low_threshold|0, options.high_threshold|0);
    console.timeEnd("canny")

    console.time("theta")
    var pixct = canvasWidth * canvasHeight
    for(var i = 0; i < pixct; i++){
        if(img_u8.data[i] == 0xff){
            // var x = i % canvasWidth, y = Math.floor(i / canvasWidth);
            // var dx = img_gxgy.data[i], dy = img_gxgy.data[i + pixct]
            // console.log(x, y)
            
            gx = img_gxgy.data[i<<1];
            gy = img_gxgy.data[(i<<1)+1];

            // console.log(gy, gx)
            theta.data[i] = Math.atan2(gy, gx)

        }
    }
    console.timeEnd("theta")

    console.time("pass1")
    var maxStrokeWidth = 30;
    var strokePoints = [];

    for(var i = 0; i < pixct; i++){
        if(img_u8.data[i] == 0xff){
            var step = 1;
            var ix = i % canvasWidth, iy = Math.floor(i / canvasWidth);
            var isStroke = false
            var itheta = theta.data[i];
            // var sizeOfRay = 0
            var rayPoints = [];
            // var pointOfRayX = []
            // var pointOfRayY = [] // create a 350 element array of zeroes

            rayPoints.push([ix, iy])

            while(step < maxStrokeWidth){
                // console.log(itheta)
                var nextX = Math.round(ix + Math.cos(itheta) * searchDirection * step)
                var nextY = Math.round(iy + Math.sin(itheta) * searchDirection * step);
                step++;

                if(nextX < 0 || nextY < 0 || nextX > canvasWidth || nextY > canvasHeight){
                    break
                }
                // pointOfRayX[sizeOfRay + 1] = nextX;
                // pointOfRayY[sizeOfRay + 1] = nextY;
                // sizeOfRay++;
                rayPoints.push([nextX, nextY])

                var nexti = nextY * canvasWidth + nextX;

                if(img_u8.data[nexti] == 0xff){
                    oppositeTheta = theta.data[nexti];
                    if(Math.abs(Math.abs(itheta - oppositeTheta) - Math.PI) < Math.PI / 2){
                        isStroke = true;
                        strokePoints.push([ix, iy])
                    }
                    break;
                }

            }
            if(isStroke == true){
                strokeWidth = Math.sqrt(Math.pow(nextX - ix, 2) + Math.pow(nextY - iy, 2))
                // console.log(strokeWidth)
                for(var j = 0; j < rayPoints.length; j++){
                    var p = rayPoints[j]
                    swtMap.data[p[0] + p[1] * canvasWidth] = Math.min(swtMap[p[0] + p[1] * canvasWidth], strokeWidth)
                }
            }
        }
    }
    console.timeEnd("pass1")


    // console.time("pass2")
    // strokePoints.forEach(function(point){
    //     var ix = point[0], iy = point[1];
    //     var i = iy * innerWidth + ix;
    //     var itheta = theta.data[i];
    //     var rayPoints = [];
    //     var swtValues = []
    //     rayPoints.push([ix, iy])

    //     swtValues.push(swtMap.data[iy * canvasWidth + ix])
    //     var step = 1;

    //     while(step < maxStrokeWidth){
    //         var nextX = Math.round(ix + Math.cos(itheta) * searchDirection * step)
    //         var nextY = Math.round(iy + Math.sin(itheta) * searchDirection * step);
    //         step++;
    //         rayPoints.push([nextX, nextY])
            
    //         var nexti = nextY * canvasWidth + nextX;
    //         swtValues.push(swtMap.data[nexti])

    //         if(img_u8.data[nexti] == 0xff){
    //             break;
    //         }
    //     }

    //     strokeWidth = median(swtValues) // IS THIS A SLICE ONE?

    //     rayPoints.forEach(function(xy){
    //         swtMap.data[xy[1] * canvasWidth + xy[0]] = Math.min(swtMap.data[xy[1] * canvasWidth + xy[0]], strokeWidth)
    //     })
    // })

    // console.timeEnd("pass2")
    
    // for(var i = 0; i < 400*400; i++){
    //     var color = swtMap.data[i];
    //     ctx.fillStyle = 'rgb('+color+',' + color + ', ' + color + ')'
    //     ctx.fillRect(i % canvasWidth, Math.floor(i / canvasWidth), 1, 1)
    // }

    console.time("blobs")

    var feat = BlobExtraction([].slice.call(swtMap.data, 0), canvasWidth, canvasHeight)

    console.timeEnd("blobs")
    // console.log(feat)

    var blobs = BlobBounds(feat, canvasWidth, canvasHeight)

    // console.log(blobs)
    var letterforms = blobs.filter(function(b){
        if(!b.sw || b.sw.length == 0) return false;

        var height = b.y2 - b.y1, width = b.x2 - b.x1;
        var aspectRatio = width / height;
        var diameter = Math.sqrt(width * width + height * height);
        
        var sws = b.sw.map(function(idx){return swtMap[idx]})
        var sum = sws.reduce(function(a, b){return a + b})
        var meansw = sum / sws.length
        var sigvarisw = 0;
        var maxsw = 0;

        sws.forEach(function(sw){
            maxsw = Math.max(sw, maxsw)
            sigvarisw += Math.pow(sw - meansw, 2)
        })

        var varisw = sigvarisw / sws.length;

        if(height > 40) return false;
        
        // if(height > 300 || height < 10) return false;
        // if(varisw / meansw > 0.5) return false;
        // if(diameter / meansw >= 10) return false;
        // if(aspectRatio < 0.1 || aspectRatio > 10) return false;
        // if(width > height * 2.5) return false;

        return true;
    })

    // console.log(letterforms)

    // img.letterforms = letterforms
    // var dataout = ctx.createImageData(canvasWidth, canvasHeight);
    // BlobColouring(dataout.data, canvasWidth, canvasHeight, feat)



    // ctx.putImageData(dataout, 0, 0)

    // ctx.strokeStyle = "red"
    // letterforms.forEach(function(letter){
    //     ctx.strokeRect(letter.x1, letter.y1, letter.x2 - letter.x1, letter.y2 - letter.y1)
    // })
    return letterforms
}


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    
    var img = new Image()
    img.src = request.url;
    
    img.onload = function(){
        if(request.ocr){
            var canvas = document.createElement('canvas');
            canvas.width = request.ocr.width;
            canvas.height = request.ocr.height;
            canvas.getContext('2d').drawImage(img, request.ocr.x, request.ocr.y, request.ocr.width, request.ocr.height, 0, 0, request.ocr.width, request.ocr.height);

            var xhr = new XMLHttpRequest()
            xhr.open('POST', 'http://cab.antimatter15.com:8090/', true)
            xhr.onload = function(){
                console.log(xhr.responseText)
                sendResponse(xhr.responseText)
            }
            xhr.send(canvas.toDataURL('image/png'))
        }else{

        sendResponse(process(img))
      }
  }

    return true;
  });