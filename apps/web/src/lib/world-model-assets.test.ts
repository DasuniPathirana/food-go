import assert from "node:assert/strict";
import test from "node:test";
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { groundWorldModel, parseWorldManifest } from "./world-model-assets";

test("only exact local model filenames and explicit venue associations are permitted", () => {
  const parsed = parseWorldManifest({ version: 1,
    assets: { kyotoRestaurant: "kyoto-restaurant.glb", parkTree: "https://bad.invalid/tree.glb", riverRock: "../rock.glb" },
    venueModels: { "the-ovenhouse-model": "kyotoRestaurant", "unapproved": "parkTree" } });
  assert.deepEqual(parsed.assets, { kyotoRestaurant: "kyoto-restaurant.glb" });
  assert.equal(parsed.venueModels["the-ovenhouse-model"], "kyotoRestaurant");
  assert.equal(parsed.venueModels.unapproved, undefined);
  assert.equal(parsed.venueModels.toString, undefined);
});

test("model alignment centres the footprint and grounds the lowest point", () => {
  const mesh = new Mesh(new BoxGeometry(20, 10, 12), new MeshBasicMaterial());
  mesh.position.set(8, -3, 9);
  const model = groundWorldModel(mesh, 10, 10);
  assert.ok(model);
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  assert.ok(Math.abs(box.min.y) < 1e-8);
  assert.ok(Math.abs(centre.x) < 1e-8 && Math.abs(centre.z) < 1e-8);
  assert.equal(size.x, 10);
  assert.equal(size.y, 5);
  mesh.geometry.dispose(); mesh.material.dispose();
});
