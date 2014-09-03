// ctx = document.getElementById("blah").getContext('2d')


// shamelessly lifted off quirksmode
function findPos(obj) {
    var curleft = curtop = 0;

    if (obj.offsetParent) {
        do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
        } while (obj = obj.offsetParent);

        return [curleft, curtop];
    }
}

// stolen from stackoverflow

function IsImageOk(img) {
    // During the onload event, IE correctly identifies any images that
    // weren’t downloaded as not complete. Others should too. Gecko-based
    // browsers act like NS4 in that they report this incorrectly.
    if (!img.complete) {
        return false;
    }

    // However, they do have two very useful properties: naturalWidth and
    // naturalHeight. These give the true size of the image. If it failed
    // to load, either of these should be zero.

    if (typeof img.naturalWidth != "undefined" && img.naturalWidth == 0) {
        return false;
    }

    // No other way of checking: assume it’s ok.
    return true;
}

function distance(rect, x, y) {
  var dx = Math.max(rect.x1 - x, 0, x - rect.x2);
  var dy = Math.max(rect.y1 - y, 0, y - rect.y2);
  return Math.sqrt(dx*dx + dy*dy);
}

var cursor_start = null;
var cursor_end = null;


window.onmousedown = function(e){
    var elpos = findPos(e.target);
    var X = e.pageX - elpos[0],
        Y = e.pageY - elpos[1];

    if(e.target.tagName.toLowerCase() == "img" && e.button == 0){
        if(IsImageOk(e.target)){
            if(e.target.letterforms){
                cursor_start = null;
                cursor_end = null;

                var letters = e.target.letterforms;

                var mindist = Infinity;
                var minblock;
                letters.forEach(function(e){
                    var dist = distance(e, X, Y);
                    if(dist < mindist){
                        mindist = dist;
                        minblock = e;
                    }
                })

                // if(mindist < )
                var height = minblock.y2 - minblock.y1, width = minblock.x2 - minblock.x1;
                var aspectRatio = width / height;
                var diameter = Math.sqrt(width * width + height * height);
                // console.log(mindist, diameter)
                if(mindist < diameter / 3){ //3 is a magic number i pulled out of my ass

                    cursor_start = minblock;

                    // ctx.fillRect(minblock.x1, minblock.y1, 10, 10)
                    
                    var params = calculateLineParameters(letters, minblock)
                    // console.log(params)
                    // ctx.fillRect(params[0], params[1], params[2] - params[0], params[3] - params[1])

                    e.preventDefault()
                    mouse_down = true

                    render_selection(e.target)
                }
                

            }else if(e.target.forkedProcessor){
                e.preventDefault()
            }

        }
    }

}

var selection_boxes = [];
function select_line(el, x1, y1, x2, y2){

    var elpos = findPos(el);
    var vp = 0, hp = 3;
    var div = document.createElement('div');
    selection_boxes.push(div)
    div.style.position = 'absolute'
    div.style.top = (elpos[1] + y1 - vp) + 'px'
    div.style.left = (elpos[0] + x1 - hp) + 'px'
    div.style.width = (x2 - x1 + 2 * hp) + 'px'
    div.style.height = (y2 - y1 + 2 * vp) + 'px'
    div.style.backgroundColor = 'rgba(0,100,255,0.4)'
    div.style.userSelect = 'none'
    div.style.pointerEvents = 'none'
    document.body.appendChild(div)
}

function render_selection(target){
    for(var i = 0; i < selection_boxes.length; i++){
        selection_boxes[i].parentNode.removeChild(selection_boxes[i])
    }
    selection_boxes = [];

    if(cursor_start && cursor_end){
        var letters = target.letterforms;

        var ps = calculateLineParameters(letters, cursor_start)
        var pe = calculateLineParameters(letters, cursor_end)

        if(ps.join() == pe.join()){

            select_line(target, Math.min(cursor_start.x2, cursor_end.x1),  ps[1], Math.max(cursor_start.x1, cursor_end.x2),  ps[3])
        }else{
            select_line(target, cursor_start.x1,  ps[1], ps[2],  ps[3])
            select_line(target, ps[0], ps[3], pe[2], pe[1])
            select_line(target, pe[0], pe[1], cursor_end.x2, pe[3])
        }    
    }
    
}

mouse_down = false

window.onmousemove = function(e){
    var elpos = findPos(e.target);
    var X = e.pageX - elpos[0],
        Y = e.pageY - elpos[1];

    if(e.target.tagName.toLowerCase() == "img"){
        if(IsImageOk(e.target)){
            if(e.target.letterforms){
                var letters = e.target.letterforms;

                var mindist = Infinity;
                var minblock;
                letters.forEach(function(e){
                    var dist = distance(e, X, Y);
                    if(dist < mindist){
                        mindist = dist;
                        minblock = e;
                    }
                })

                // if(mindist < )
                var height = minblock.y2 - minblock.y1, width = minblock.x2 - minblock.x1;
                var aspectRatio = width / height;
                var diameter = Math.sqrt(width * width + height * height);
                // console.log(mindist, diameter)
                if(mindist < diameter / 3){ //3 is a magic number i pulled out of my ass


                    if(mouse_down){

                        cursor_end = minblock;
                        e.preventDefault()
                        render_selection(e.target)
                    }else{
                        e.target.style.cursor = 'text'
                    }
                }else{

                        e.target.style.cursor = 'auto'
                }
                

            }else if(e.target.forkedProcessor){
                e.preventDefault()
                e.target.style.cursor = 'progress'
            }

        }
    }
}

window.onmouseup = function(e){
    
    mouse_down = false;
    if(cursor_start){
        e.preventDefault()
        e.stopPropagation()
    }


    var letters = e.target.letterforms;

    var ps = calculateLineParameters(letters, cursor_start)
    var pe = calculateLineParameters(letters, cursor_end)

    chrome.runtime.sendMessage({
        url: e.target.src,
        ocr: {
            width: ps[2] - ps[0],
            height: ps[3] - ps[1],
            x: ps[0],
            y: ps[1]
        }
    }, function(response) {
          console.log("GOT STUFF", response)
    });
}

window.ondblclick = function(e){

}


function calculateLineParameters(letters, root){
    var y_min = Infinity;
    var y_max = -Infinity;
    function recursiveNext(block, direction){
        var thresh = Math.max(block.x2 - block.x1, block.y2 - block.y1) * 4

        var minblock, mindist = Infinity;
        letters.filter(function(e){
            if(e == block) return;
            var ym = (e.y2 + e.y1) / 2;
            if(block.y1 < ym && ym < block.y2){
                return true
            }
            return false
        }).forEach(function(e){
            if(direction == 1){
                // console.log('diff', e.x1 - block.x2, mindist)
                if(e.x1 - block.x2 > 0 && e.x1 - block.x2 < thresh){
                    if(e.x1 - block.x2 < mindist){
                        mindist = e.x1 - block.x2 
                        minblock = e;
                    }
                }
            }else{
                if(block.x1 - e.x2 > 0 && block.x1 - e.x2 < thresh){
                    if(block.x1 - e.x2 < mindist){
                        mindist = block.x1 - e.x2 
                        minblock = e
                    }
                }
            }  
        })
        if(minblock){
            // console.log('got minblock')
            y_max = Math.max(block.y2, y_max)
            y_min = Math.min(block.y1, y_min)

            return recursiveNext(minblock, direction)
        }else{
            return block
        }
    }

    var x_max = recursiveNext(root, 1)
    var x_min = recursiveNext(root, -1)

    return [x_min.x1, y_min, x_max.x2, y_max]
}

window.onmouseover = function(e){
    if(e.target.tagName.toLowerCase() == "img"){
        if(IsImageOk(e.target)){
            if(!e.target.forkedProcessor){
                console.log('processing image woop')
                e.target.style.cursor = 'progress'

                // ctx.drawImage(e.target, 0, 0)
                // process(e.target)
                // setTimeout(process, 10)
                
                chrome.runtime.sendMessage({url: e.target.src}, function(response) {
                      e.target.letterforms = response
                      console.log('got letterforms')
                      e.target.style.cursor = 'auto'
                });
            }
            e.target.forkedProcessor = true;
        }
    }
}