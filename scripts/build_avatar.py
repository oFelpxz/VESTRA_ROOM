"""
Monta o avatar_base.glb a partir dos exports do MakeHuman.

Uso (headless, sem abrir a interface do Blender):

    blender --background --python scripts/build_avatar.py -- \
        --input-dir caminho/para/os/exports \
        --output public/models/avatar_base.glb

Espera em --input-dir:
    base.obj          (corpo de referência, sliders neutros)
    height.obj         weight.obj       chest.obj    waist.obj
    hip.obj             shoulder.obj     armLength.obj  legLength.obj

Cada arquivo deve ser exportado do MakeHuman como Wavefront (.obj), partindo
sempre do MESMO corpo base e mexendo só no slider daquele eixo — isso garante
que os vértices batem 1:1 entre os arquivos (MakeHuman usa sempre a mesma
topologia, então a contagem/ordem de vértices não muda com os sliders).

Arquivos de eixo que não existirem em --input-dir são pulados (dá pra montar
só um subconjunto dos 8 eixos e completar depois).
"""

import argparse
import os
import sys

import bpy

AXES = [
    "height",
    "weight",
    "chest",
    "waist",
    "hip",
    "shoulder",
    "armLength",
    "legLength",
]


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def import_obj(filepath):
    before = set(bpy.data.objects)
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=filepath)
    else:
        # Blender < 4.0 — importador legado (addon "Import-Export: Wavefront OBJ")
        bpy.ops.import_scene.obj(filepath=filepath)
    after = set(bpy.data.objects) - before
    if not after:
        raise RuntimeError(f"Import não criou nenhum objeto: {filepath}")
    return next(iter(after))


def main():
    args = parse_args()

    base_path = os.path.join(args.input_dir, "base.obj")
    if not os.path.isfile(base_path):
        raise FileNotFoundError(f"base.obj não encontrado em {args.input_dir}")

    # Cena limpa
    bpy.ops.wm.read_factory_settings(use_empty=True)

    base_obj = import_obj(base_path)
    base_obj.name = "AvatarBase"
    if base_obj.data.shape_keys is None:
        base_obj.shape_key_add(name="Basis")

    base_vert_count = len(base_obj.data.vertices)
    print(f"[build_avatar] base: {base_vert_count} vértices")

    applied = []
    for axis in AXES:
        variant_path = os.path.join(args.input_dir, f"{axis}.obj")
        if not os.path.isfile(variant_path):
            print(f"[build_avatar] aviso: {axis}.obj não encontrado, pulando eixo")
            continue

        variant_obj = import_obj(variant_path)
        variant_vert_count = len(variant_obj.data.vertices)
        if variant_vert_count != base_vert_count:
            bpy.data.objects.remove(variant_obj, do_unlink=True)
            raise RuntimeError(
                f"Contagem de vértices diferente em '{axis}': "
                f"base={base_vert_count} variante={variant_vert_count}. "
                "Confirme que os dois exports vieram do mesmo corpo-base no MakeHuman."
            )

        bpy.ops.object.select_all(action="DESELECT")
        variant_obj.select_set(True)
        base_obj.select_set(True)
        bpy.context.view_layer.objects.active = base_obj

        bpy.ops.object.join_shapes()
        base_obj.data.shape_keys.key_blocks[-1].name = axis
        applied.append(axis)

        bpy.data.objects.remove(variant_obj, do_unlink=True)

    if not applied:
        raise RuntimeError("Nenhum eixo aplicado — confira os nomes dos arquivos em --input-dir")

    print(f"[build_avatar] shape keys aplicadas: {', '.join(applied)}")

    bpy.ops.object.select_all(action="DESELECT")
    base_obj.select_set(True)
    bpy.context.view_layer.objects.active = base_obj

    os.makedirs(os.path.dirname(os.path.abspath(args.output)) or ".", exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        use_selection=True,
        export_morph=True,
        export_apply=True,
    )
    print(f"[build_avatar] exportado: {args.output}")


if __name__ == "__main__":
    main()
