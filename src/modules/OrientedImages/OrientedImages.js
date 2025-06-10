import * as THREE from "../../../libs/three.js/build/three.module.js";
import { OrientedImageControls } from "./OrientedImageControls.js";
import { EventDispatcher } from "../../EventDispatcher.js";

function createMaterial() {
  let vertexShader = `
	uniform float uNear;
	varying vec2 vUV;
	varying vec4 vDebug;

	void main(){
		vDebug = vec4(0.0, 1.0, 0.0, 1.0);
		vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
		// make sure that this mesh is at least in front of the near plane
		modelViewPosition.xyz += normalize(modelViewPosition.xyz) * uNear;
		gl_Position = projectionMatrix * modelViewPosition;
		vUV = uv;
	}
	`;

  let fragmentShader = `
	uniform sampler2D tColor;
	uniform float uOpacity;
	varying vec2 vUV;
	varying vec4 vDebug;
	void main(){
		vec4 color = texture2D(tColor, vUV);
		gl_FragColor = color;
		gl_FragColor.a = uOpacity;
	}
	`;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: new THREE.Texture() },
      uNear: { value: 0.0 },
      uOpacity: { value: 1.0 },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.DoubleSide,
  });

  material.side = THREE.DoubleSide;

  return material;
}

const planeGeometry = new THREE.PlaneGeometry(1, 1);
const lineGeometry = new THREE.BufferGeometry();

const vertices = new Float32Array([
  -0.5, -0.5, 0,
   0.5, -0.5, 0,
   0.5,  0.5, 0,
  -0.5,  0.5, 0,
  // -0.5, -0.5, 0
]);

const indices = [
	0,1,2,3,0
]

lineGeometry.setIndex(indices)
lineGeometry.setAttribute('position', new THREE.BufferAttribute( vertices, 3 ))

export class OrientedImage {
  constructor(id) {
    this.id = id;
    this.fov = 1.0;
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Vector3();
    this.width = 0;
    this.height = 0;
    this.fov = 1.0;

    const material = createMaterial();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(planeGeometry, material);
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.texture = null;

    this.mesh.orientedImage = this;
  }

  set(position, rotation, dimension, fov) {
    let radians = rotation.map(THREE.MathUtils.degToRad);

    this.position.set(...position);
    this.mesh.position.set(...position);

    this.rotation.set(...radians);
    this.mesh.rotation.set(...radians);

    [this.width, this.height] = dimension;
    this.mesh.scale.set(this.width / this.height, 1, 1);

    this.fov = fov;

    this.updateTransform();
  }

  updateTransform() {
    let { mesh, line, fov } = this;

    mesh.updateMatrixWorld();
    var dir = new THREE.Vector3();
    mesh.getWorldDirection(dir);
    const alpha = THREE.MathUtils.degToRad(fov / 2);
    const d = -0.5 / Math.tan(alpha);
    const move = dir.clone().multiplyScalar(d);
    mesh.position.add(move);

    line.position.copy(mesh.position);
    line.scale.copy(mesh.scale);
    line.rotation.copy(mesh.rotation);
  }
}

export class OrientedImages extends EventDispatcher {
  constructor() {
    super();

    this.node = null;
    this.cameraParams = null;
    this.imageParams = null;
    this.images = null;
    this._visible = true;
    this.focused = null;
  }

  set visible(visible) {
    if (this._visible === visible) {
      return;
    }

    for (const image of this.images) {
      image.mesh.visible = visible;
      image.line.visible = visible;
    }

    this._visible = visible;
    this.dispatchEvent({
      type: "visibility_changed",
      images: this,
    });
  }

  get visible() {
    return this._visible;
  }
}

export class OrientedImageLoader {
  static async loadCameraParams(path) {
    const res = await fetch(path);
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");

    const width = parseInt(doc.getElementsByTagName("width")[0].textContent);
    const height = parseInt(doc.getElementsByTagName("height")[0].textContent);
    const f = parseFloat(doc.getElementsByTagName("f")[0].textContent);

    let a = height / 2 / f;
    let fov = 2 * THREE.MathUtils.radToDeg(Math.atan(a));

    const params = {
      path: path,
      width: width,
      height: height,
      f: f,
      fov: fov,
    };

    return params;
  }

  static async loadImageParams(path, tm, isLocal = false) {
    const response = await fetch(path);
    if (!response.ok) {
      console.error(`failed to load ${path}`);
      return;
    }

    const content = await response.text();

    const imageParams = [];

    const imgData = JSON.parse(content);

    imgData.camname.forEach((imgName, index) => {
      const rawPos = new THREE.Vector4(
        Number.parseFloat(isLocal ? imgData.camX[index] * 1000 : imgData.camX[index]),
        Number.parseFloat(isLocal ? imgData.camY[index] * 1000 : imgData.camY[index]),
        Number.parseFloat(isLocal ? imgData.camZ[index] * 1000 : imgData.camZ[index]),
        1
      );
      rawPos.applyMatrix4(tm);

      const params = {
        id: imgData.camname[index],
        x: Number.parseFloat(isLocal ? imgData.camX[index] * 1000 : imgData.camX[index]),
        y: Number.parseFloat(isLocal ? imgData.camY[index] * 1000 : imgData.camY[index]),
        z: Number.parseFloat(isLocal ? imgData.camZ[index] * 1000 : imgData.camZ[index]),
        x_tm: rawPos.x,
        y_tm: rawPos.y,
        z_tm: rawPos.z,
        omega: Number.parseFloat(imgData.camRoll[index]),
        phi: Number.parseFloat(imgData.camPitch[index]),
        kappa: Number.parseFloat(imgData.camYaw[index]),
      };

      imageParams.push(params);
    });

    const width = parseInt(imgData.camPix[0]);
    const height = parseInt(imgData.camPix[1]);
    const f = parseFloat(imgData.camFocal);

    let a = height / 2 / f;
    let fov = 2 * THREE.MathUtils.radToDeg(Math.atan(a));

    const params = {
      path: path,
      width: width,
      height: height,
      f: f,
      fov: fov,
    };

    return [params, imageParams];
  }

  static async load(imageData, imagesPath, viewer, tm_data, isLocal = false) {
    const tStart = performance.now();

    let tmatrix, toffset;

    tmatrix = tm_data.tm;
    toffset = tm_data.offset;

    const [cameraParams, imageParams] =
    OrientedImageLoader.loadImageParamsFromData(imageData);

    const orientedImageControls = new OrientedImageControls(viewer);
    const raycaster = new THREE.Raycaster();

    const tEnd = performance.now();
    console.log(tEnd - tStart);

    const { width, height } = cameraParams;
    const orientedImages = [];
    const sceneNode = new THREE.Object3D();
    sceneNode.name = "oriented_images";

    for (const params of imageParams) {
      const { x, y, z, x_tm, y_tm, z_tm, omega, phi, kappa } = params;
      let orientedImage = new OrientedImage(params.id);
      let position = [x, y, z];
      let rotation = [omega, phi, kappa];
      let dimension = [width, height];
      orientedImage.set(position, rotation, dimension, cameraParams.fov);
      orientedImage.mesh.applyMatrix4(tmatrix);
      let curMeshPos = orientedImage.mesh.position.clone();
      orientedImage.mesh.position.set(
        curMeshPos.x - toffset[0],
        curMeshPos.y - toffset[1],
        curMeshPos.z - toffset[2]
      );
      orientedImage.line.applyMatrix4(tmatrix);
      let curLinePos = orientedImage.line.position.clone();
      orientedImage.line.position.set(
        curLinePos.x - toffset[0],
        curLinePos.y - toffset[1],
        curLinePos.z - toffset[2]
      );
      orientedImage.position.set(
        x_tm - toffset[0],
        y_tm - toffset[1],
        z_tm - toffset[2]
      );
      sceneNode.add(orientedImage.mesh);
      sceneNode.add(orientedImage.line);

      orientedImages.push(orientedImage);
    }

    let hoveredElement = null;
    let clipVolume = null;

    const images = new OrientedImages();
    images.node = sceneNode;
    images.cameraParams = cameraParams;
    images.imageParams = imageParams;
    images.images = orientedImages;
    images.hovered = hoveredElement;

    const onMouseMove = (evt) => {
      const tStart = performance.now();
      if (hoveredElement) {
        hoveredElement.line.material.color.setRGB(0, 1, 0);
      }
      evt.preventDefault();
      if (images.visible) {
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        const [x, y] = [evt.clientX, evt.clientY];
        const array = [
          (x - rect.left) / rect.width,
          (y - rect.top) / rect.height,
        ];
        const onClickPosition = new THREE.Vector2(...array);
        const camera = viewer.scene.getActiveCamera();
        const mouse = new THREE.Vector3(
          +(onClickPosition.x * 2) - 1,
          -(onClickPosition.y * 2) + 1
        );
        const objects = orientedImages.map((i) => i.mesh);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(objects);
        let selectionChanged = false;

        if (intersects.length > 0) {
          const intersection = intersects[0];
          const orientedImage = intersection.object.orientedImage;
          orientedImage.line.material.color.setRGB(1, 0, 0);
          selectionChanged = hoveredElement !== orientedImage;
          hoveredElement = orientedImage;
        } else {
          hoveredElement = null;
        }

        let shouldRemoveClipVolume =
          clipVolume !== null && hoveredElement === null;
        let shouldAddClipVolume =
          clipVolume === null && hoveredElement !== null;

        if (
          clipVolume !== null &&
          (hoveredElement === null || selectionChanged)
        ) {
          // remove existing
          viewer.scene.removePolygonClipVolume(clipVolume);
          clipVolume = null;
        }

        if (shouldAddClipVolume || selectionChanged) {
          const img = hoveredElement;
          const fov = cameraParams.fov;
          const aspect = cameraParams.width / cameraParams.height;
          const near = 1.0;
          const far = 1000 * 1000;
          const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
          camera.rotation.order = viewer.scene.getActiveCamera().rotation.order;
          camera.rotation.copy(img.mesh.rotation);
          {
            const mesh = img.mesh;
            const dir = mesh.getWorldDirection();
            const pos = mesh.position;
            const alpha = THREE.MathUtils.degToRad(fov / 2);
            const d = 0.5 / MathUtils.tan(alpha);
            const newCamPos = pos.clone().add(dir.clone().multiplyScalar(d));
            const newCamDir = pos.clone().sub(newCamPos);
            const newCamTarget = new THREE.Vector3().addVectors(
              newCamPos,
              newCamDir.clone().multiplyScalar(viewer.getMoveSpeed())
            );
            camera.position.copy(newCamPos);
          }
          let volume = new Potree.PolygonClipVolume(camera);
          let m0 = new THREE.Mesh();
          let m1 = new THREE.Mesh();
          let m2 = new THREE.Mesh();
          let m3 = new THREE.Mesh();
          m0.position.set(-1, -1, 0);
          m1.position.set(1, -1, 0);
          m2.position.set(1, 1, 0);
          m3.position.set(-1, 1, 0);
          volume.markers.push(m0, m1, m2, m3);
          volume.initialized = true;

          viewer.scene.addPolygonClipVolume(volume);
          clipVolume = volume;
        }
        const tEnd = performance.now();
        //console.log(tEnd - tStart);
      } else {
        hoveredElement = null;
        if (clipVolume) {
          viewer.scene.removePolygonClipVolume(clipVolume);
          clipVolume = null;
        }
      }
    };

    const moveToImage = async (image, sendEvent = true, type) => {
			
      if(type == 'phoneImage') viewer.controls.enabled = true;
      else viewer.controls.enabled = false;

      const mesh = image.mesh;
      const target = image;

      const newCamPos = image.position.clone();
      const newCamTarget = mesh.position.clone();

      let _isThumbnailLoaded = false;
      let _isMainLoaded = false ;

      viewer.scene.view.setView(newCamPos, newCamTarget);


      function loadImageTexture(path) {
        return new Promise((resolve, reject) => {
          new THREE.TextureLoader().load(
            path,
            (texture) => {
              resolve(texture);
            },
            undefined,
            (error) => {
              new THREE.TextureLoader().load(
                `${Potree.resourcePath}/images/loading.jpg`,
                (texture) => {
                  resolve(texture);
                }
              );
            }
          );
        });
      }
      function updateTexture(texture) {
        target.texture = texture;
        target.mesh.material.uniforms.tColor.value = texture;
        mesh.material.needsUpdate = true;
      }

      viewer.scene.orientedImages[0].focused = image;
      const loadingPath = `${Potree.resourcePath}/images/loading.jpg`;
      let loadingTexture = await loadImageTexture(loadingPath);
      if(!_isThumbnailLoaded){
      updateTexture(loadingTexture);
      }
      const tmpImagePath = `${imagesPath}/thumbnails/${target.id}`;
      let texture = await loadImageTexture(tmpImagePath);
      _isThumbnailLoaded = true ;
      if(!_isMainLoaded){
        updateTexture(texture);
      }
      if (sendEvent) {
        const event = new CustomEvent("imageLoad", {
          detail: {
            viewer: viewer.canvasId,
            image,
          },
        });
        document.dispatchEvent(event);
      }
      // setTimeout(() => {
      //   orientedImageControls.capture(image);
      // }, 100);
      const imagePath = `${imagesPath}/${target.id}`;
      let texture_org = await loadImageTexture(imagePath);
      _isMainLoaded=true;
      updateTexture(texture_org);
      image.texture = texture_org;
    };


		const onMouseClick = (evt) => {

    let is360ImageLoaded = viewer.scene.images360 && viewer.scene.images360.some(
		(fcsimage) => !!fcsimage.focusedImage,
	);
		if (hoveredElement && !is360ImageLoaded) {
			const event = new CustomEvent('loadedOrientedImageClicked', {
				detail: hoveredElement,
			});
			document.dispatchEvent(event);
		}
		if (orientedImageControls.hasSomethingCaptured()) {
			return;
		}

		if (hoveredElement && !is360ImageLoaded) {
			const parts = hoveredElement.id.split('_')
			if(parts.some(part => part.includes('phoneImage'))){
				moveToImage(hoveredElement , true , 'phoneImage');
			}
			else{
				moveToImage(hoveredElement , true , 'droneImage');
			}
		}
	};
    viewer.renderer.domElement.addEventListener(
      "mousemove",
      onMouseMove,
      false
    );
    viewer.renderer.domElement.addEventListener(
      "mousedown",
      onMouseClick,
      false
    );

    viewer.addEventListener("update", () => {
      for (const image of orientedImages) {
        const world = image.mesh.matrixWorld;
        const { width, height } = image;
        let aspect = width / height;

			  if(image.texture && image.texture.image){
				  aspect = image.texture.image.width / image.texture.image.height;
			  }

        const camera = viewer.scene.getActiveCamera();

        const imgPos = image.mesh.getWorldPosition(new THREE.Vector3());
        const camPos = camera.position;
        const d = camPos.distanceTo(imgPos);

				const minSize = 1; // in degrees of fov
				const a = THREE.MathUtils.degToRad(minSize);
				let r = d * Math.tan(a);
				r = Math.max(r, 1);

        image.mesh.scale.set(r * aspect, r, 1);
        image.line.scale.set(r * aspect, r, 1);

        image.mesh.material.uniforms.uNear.value = camera.near;
      }
    });

    images.moveToImage = moveToImage;
    images.release = function () {
      orientedImageControls.release();
    };
    return images;
  }
  static loadImageParamsFromData(imageData) {
    const imageParams = [];
  let width;
  let height;
  let f;

  Object.keys(imageData).forEach((key)=>{
      const params = {
        id: key,
        x: imageData[key].position[0],
        y: imageData[key].position[1],
        z: imageData[key].position[2],
        x_tm: imageData[key].position[0],
        y_tm: imageData[key].position[1],
        z_tm: imageData[key].position[2],
        omega: Number.parseFloat(imageData[key].rotation[0]),
        phi: Number.parseFloat(imageData[key].rotation[1]),
        kappa: Number.parseFloat(imageData[key].rotation[2]),
      };
    width = parseInt(imageData[key].camPix[0]);
      height = parseInt(imageData[key].camPix[1]);
      f = parseFloat(imageData[key].camFocal);
      imageParams.push(params);
    });
    let a = height / 2 / f;
    let fov = 2 * MathUtils$1.radToDeg(Math.atan(a));
    const params = {
      width: width,
      height: height,
      f: f,
      fov: fov,
    };
    return [params, imageParams];
  }
}
