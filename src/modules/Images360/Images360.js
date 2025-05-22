
import * as THREE from "../../../libs/three.js/build/three.module.js";
import { EventDispatcher } from "../../EventDispatcher.js";
class Image360{

	constructor(file, thumbnail, longitude, latitude, altitude, course, pitch, roll){
		this.file = file;
		this.thumbnail = thumbnail;
		this.longitude = longitude;
		this.latitude = latitude;
		this.altitude = altitude;
		this.course = course;
		this.pitch = pitch;
		this.roll = roll;
		this.ringGroup=null
		this.visibleRings=[]
	}
};

export class Images360 extends EventDispatcher{

	constructor(viewer){
		super();

		this.viewer = viewer;

		this.selectingEnabled = true;

		this.images = [];
		this.node = new THREE.Object3D();
		this.visibleRings=[]		
		this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), new THREE.MeshBasicMaterial({side: THREE.BackSide}));
		this.sphere.visible = false;
		this.sphere.scale.set(-1000, 1000, 1000);
		this.focus = this.focus.bind(this);
		this.unfocus = this.unfocus.bind(this);
		this.node.add(this.sphere);
		this._visible = true;
		this.focusedImage = null;
		this.currentlyHovered = null;
		this.previousView = {
			controls: null,
			position: null,
			target: null,
		};
		this.raycaster = new THREE.Raycaster();
		this.hoverMaterial = new THREE.MeshBasicMaterial({side: THREE.DoubleSide,color:''});
		this.sm = new THREE.MeshBasicMaterial({side: THREE.DoubleSide,color:'#c03624'});
		viewer.addEventListener("update", () => {
			this.update(viewer);
		});
		viewer.inputHandler.addInputListener(this);

		this.addEventListener("mousedown", () => {
			if(this.currentlyHovered && this.currentlyHovered.image360){
				this.focus(this.currentlyHovered.image360);
				const event = new CustomEvent("onRingClick", {
                    detail: {
                        viewer: this.viewer,
                        image: this.currentlyHovered.image360
                    }
                });
                document.dispatchEvent(event);
			}
		});
		this.addEventListener("touchend", () => {
			if(this.currentlyHovered && this.currentlyHovered.image360){
				// this.focus(this.currentlyHovered.image360);
				const event = new CustomEvent("onRingClick", {
                    detail: {
                        viewer: this.viewer,
                        image: this.currentlyHovered.image360
                    }
                });
                document.dispatchEvent(event);
			}
		});
	};

	set visible(visible){
		if(this._visible === visible){
			return;
		}


		for(const image of this.images){
			image.ringGroup.visible = visible && (this.focusedImage == null);
		}

		this.sphere.visible = visible && (this.focusedImage != null);
		this._visible = visible;
		this.dispatchEvent({
			type: "visibility_changed",
			images: this,
		});
	}

	get visible(){
		return this._visible;
	}

	focus(image360, reversePan = false, sendEvent = true, inTarget = null){
		if(this.focusedImage !== null){
			this.unfocus();
		}
		this.viewer.setEDLOpacity(0);
		if (sendEvent) {
			const event = new CustomEvent("panoLoad", {
				detail: {
					viewer: this.viewer.canvasId,
					image: image360
				}
			});
			document.dispatchEvent(event);
		}

		this.previousView = {
			controls: this.viewer.controls,
			position: this.viewer.scene.view.position.clone(),
			target: this.viewer.scene.view.getPivot(),
		};
		this.viewer.setControls(this.viewer.orbitControls);
		this.viewer.orbitControls.isInterior = true;
		this.viewer.orbitControls.reversePan = reversePan;
		this.viewer.orbitControls.doubleClockZoomEnabled = false;
		let index = this.images.findIndex( element => {
		if (element.file === image360.file) {
		return true;
		}
		});
		
		for(let image of this.images){
			image.ringGroup.visible=false
		}
		
		//One ring on each side with 3m distance 
		// if(index != 0)
		// {

		// 	let i = index - 1;
		// 	let current = new Vector3(this.images[index].position[0], this.images[index].position[1], this.images[index].position[2]);
		// 	let next = new Vector3(this.images[i].position[0], this.images[i].position[1], this.images[i].position[2]);
		// 	let dist = current.distanceTo(next);
		// 	while(dist < 3 && i > 0) {
		// 		i--;
		// 		next = new Vector3(this.images[i].position[0], this.images[i].position[1], this.images[i].position[2]);
		// 		dist = current.distanceTo(next);
		// 	}
		// 	if(i>-1)
		// 	{
		// 	this.images[i].ringGroup.visible = this.showRings ? true: false;
		// 	this.visibleRings.push(this.images[i]);
		// 	}
			
		// }
		// if(index!=this.images.length-1)
		// {
		// 	let i = index + 1;
		// 	let current = new Vector3(this.images[index].position[0], this.images[index].position[1], this.images[index].position[2]);
		// 	let next = new Vector3(this.images[i].position[0], this.images[i].position[1], this.images[i].position[2]);
		// 	let dist = current.distanceTo(next);
		// 	while(dist < 3 && i<this.images.length-1) {
		// 		i++;
		// 		next = new Vector3(this.images[i].position[0], this.images[i].position[1], this.images[i].position[2]);
		// 		dist = current.distanceTo(next);
		// 	}
		// 	if(i<this.images.length)
		// 	{
		// 	this.images[i].ringGroup.visible = this.showRings ? true: false;
		// 	this.visibleRings.push(this.images[i]);	
		// 	}
		// }
		
		//	Two rings on each side without 3m distance
		if(index != 0) {
			let prevImages = [];
			let i = index - 1;
			if(i >= 0) prevImages.push(i);  // i-1
			if(i-1 >= 0) prevImages.push(i-1);  // i-2
			
			for (let prevIndex of prevImages) {
				this.images[prevIndex].ringGroup.visible = this.showRings ? true : false;
				this.visibleRings.push(this.images[prevIndex]);
			}
		}

		if(index != this.images.length - 1) {
			let nextImages = [];
			let i = index + 1;
			if(i < this.images.length) nextImages.push(i);  // i+1
			if(i+1 < this.images.length) nextImages.push(i+1);  // i+2

			for (let nextIndex of nextImages) {
				this.images[nextIndex].ringGroup.visible = this.showRings ? true : false;
				this.visibleRings.push(this.images[nextIndex]);
			}
		}
		this.selectingEnabled = true;
		
		this.sphere.visible = false;
		this.load(image360).then( () => {
			if (this.sphere) {
				this.sphere.visible = true;
				this.sphere.material.map = image360.texture;
				this.sphere.material.needsUpdate = true;
			}
		});
			let {course, pitch, roll} = image360;
			this.sphere.rotation.set(
				THREE.MathUtils.degToRad(course),
				THREE.MathUtils.degToRad(pitch),
				THREE.MathUtils.degToRad(+roll),
				"XYZ"
			);
		this.sphere.position.set(...image360.position);
		
		let target = new THREE.Vector3(...image360.position);
		let dir = target.clone().sub(this.viewer.scene.view.position).normalize();
		let move = dir.multiplyScalar(0.000001);
		let newCamPos = target.clone().sub(move);
		this.viewer.scene.view.setView(
			newCamPos, 
			target,
			500,
			() => {
				if (inTarget) {
					if (inTarget.pitch) {
						this.viewer.scene.view.pitch = inTarget.pitch
					}
					if (inTarget.yaw) {
						this.viewer.scene.view.yaw = inTarget.yaw
					}
				}
			}
		);

		this.focusedImage = image360;

	}

	unfocus(sendEvent = true){
		this.selectingEnabled = true;
		this.viewer.setEDLOpacity(1);
		for(let image of this.images){
			image.ringGroup.visible = false;
		}
		let image = this.focusedImage;
		if(image === null){
			return;
		}
		this.sphere.material.map = null;
		this.sphere.material.needsUpdate = true;
		this.sphere.visible = false;
		this.sphere.position.set(this.sphere.position - [...this.images[0].position]);

		let pos = this.viewer.scene.view.position;
		let target = this.viewer.scene.view.getPivot();
		let dir = target.clone().sub(pos).normalize();
		let move = dir.multiplyScalar(10);
		let newCamPos = target.clone().sub(move);

		this.viewer.orbitControls.doubleClockZoomEnabled = true;
		this.viewer.orbitControls.isInterior = false;
		this.viewer.orbitControls.reversePan = false;
		this.viewer.setControls(this.previousView.controls);
		this.focusedImage = null;
		
		if (sendEvent) {
			const event = new CustomEvent("panoUnload", {
				detail: {
					viewer: this.viewer.canvasId
				}
			});
			document.dispatchEvent(event);
		}

	}

	load(image360){
		let resolved = false;
		return new Promise(resolve => {
			if (image360.texture) {
				resolve(null);
			} else {
				new THREE.TextureLoader().load(image360.thumbnail,
					texture => {
							//var sphereMaterial = new MeshBasicMaterial({ map: texture, side: DoubleSide });
                            //image360.texture = sphereMaterial;
							image360.texture = texture;
							resolved = true;
							resolve(null);
							loadOrgImage.bind(this)();
						},
					undefined,
					err => {
						loadOrgImage.bind(this)();
					});
				let loadOrgImage = function () {

					new THREE.TextureLoader().load(image360.file,
						texture => {
								//var sphereMaterial = new MeshBasicMaterial({ map: texture, side: DoubleSide });
                            	//image360.texture = sphereMaterial;
								// texture.magFilter = THREE.NearestFilter;
								texture.minFilter = THREE.LinearFilter;
								// texture.anisotropy = this.viewer.renderer.capabilities.getMaxAnisotropy();
								image360.texture = texture;
								if (this.sphere) {
									this.sphere.visible = true;
									this.sphere.material.map = image360.texture;
									this.sphere.material.needsUpdate = true;
								}
								if (!resolved) {
									resolve(null);
								}
							});
				}

			}
		});

	}

	handleHovering(){
		let mouse = this.viewer.inputHandler.mouse;
		let camera = this.viewer.scene.getActiveCamera();
		let domElement = this.viewer.renderer.domElement;
		let ray = Potree.Utils.mouseToRay(mouse, camera, domElement.clientWidth, domElement.clientHeight);
		this.raycaster.ray.copy(ray);
		let intersections = this.raycaster.intersectObjects(this.visibleRings.map(image=>{
			return image.ringGroup.children[1]}));
		if(intersections.length === 0){
			return;
		}
		let intersection = intersections[0];
		if(intersection.object.parent.visible===true)
		{
		this.currentlyHovered = intersection.object.parent.children[0];
		this.currentlyHovered.material = this.hoverMaterial;
		}
		
	}

	update(){

		let {viewer} = this;
		if(this.currentlyHovered){
			this.currentlyHovered.material = this.sm;
			this.currentlyHovered = null;
		}

		if(this.selectingEnabled){
			this.handleHovering();
		}

	}
};


export class Images360Loader{

	static async load(url, imgsUrl, viewer, tm_data, isLocal = false, params = {}){

		if(!params.transform){
			params.transform = {
				forward: a => a,
			};
		}

		let tmatrix, toffset;
		
		tmatrix = tm_data.tm;
		toffset = tm_data.offset;
		
		let response = await fetch(url);
		let text = await response.text();
		let imgData = JSON.parse(text);

		if (!this.instance) {
			this.instance = new Images360(viewer);
		}

		let images360 = this.instance;

		Object.keys(imgData).forEach(imgName => {
			let raw_position = imgData[imgName].position;
			let rotation = imgData[imgName].rotation;
			
			let pos = new THREE.Vector4(raw_position[0], raw_position[1], raw_position[2], 1);
			if (isLocal == true) {
				pos = new THREE.Vector4(raw_position[0] * 1000, raw_position[1] * 1000, raw_position[2] * 1000, 1);
			}
			pos.applyMatrix4(tmatrix);
			const long = parseFloat(pos.x - toffset[0]);
			const lat = parseFloat(pos.y - toffset[1]);
			const alt = parseFloat((pos.z - toffset[2]));
			const course = parseFloat(rotation[0]);
			const pitch = parseFloat(rotation[1]);
			const roll = parseFloat(rotation[2]);

			let file = `${imgsUrl}/${imgName}`;
			let thumbnail = `${imgsUrl}/thumbnails/${imgName}`;
			let image360 = new Image360(file, thumbnail, long, lat, alt, course, pitch, roll);

			let position = [long, lat, alt];
			image360.position = position;

			images360.images.push(image360);
			// images360.visibleRings.push(image360);
		});

		images360.images.sort(function (a, b) {
			const getFileNumber = (file) => {
				const numberPattern = /\d+/g;
				const numbers = file.match(numberPattern);
				if (numbers) {
				return numbers.map((num) => num.padStart(10, '0')).join('');
				}
				return file;
			};

			const fileANumber = getFileNumber(a.file);
			const fileBNumber = getFileNumber(b.file);
			return fileANumber.localeCompare(fileBNumber);
		});

		//  Images360Loader.createSceneNodes(images360);
			return images360;

	}

	static createSceneNodes(images360){

		for(let image360 of images360.images){
			let {longitude, latitude, altitude} = image360;
			let ringMesh = new THREE.Mesh(new THREE.RingGeometry( 0.35, .5, 32 ), new THREE.MeshBasicMaterial({side: THREE.DoubleSide, color:'#c03624'}));
			ringMesh.position.set(longitude, latitude, altitude - 2.0);
			ringMesh.scale.set(1, 1, 1);
			ringMesh.material.transparent = true;
			ringMesh.material.opacity = 0.75;
			ringMesh.image360 = image360;
			let circleMesh = new THREE.Mesh(new THREE.CircleGeometry( .5, 32 ), new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
			circleMesh.position.set(longitude, latitude, altitude - 2.0);
			circleMesh.scale.set(1, 1, 1);
			circleMesh.material.transparent = true;
			circleMesh.material.opacity = 0;
			circleMesh.image360 = image360;
			const ringGroup = new THREE.Group();
			ringGroup.add( ringMesh );
			ringGroup.add( circleMesh );
			images360.node.add(ringGroup);
			image360.ringGroup=ringGroup
			image360.ringGroup.visible=false;
		}
	}
};

