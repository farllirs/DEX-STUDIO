#!/usr/bin/env python3
"""
{{APP_NAME}} — Aplicación CLI
Creado por {{CREATOR}} con DEX STUDIO
"""

import argparse
import sys

__version__ = "{{VERSION}}"

def main():
    parser = argparse.ArgumentParser(
        prog="{{APP_NAME}}",
        description="{{DESCRIPTION}}"
    )
    parser.add_argument('-v', '--version', action='version',
                        version=f'%(prog)s {__version__}')
    parser.add_argument('nombre', nargs='?', default='Mundo',
                        help='Nombre para saludar')
    parser.add_argument('-c', '--count', type=int, default=1,
                        help='Número de saludos')

    args = parser.parse_args()

    for i in range(args.count):
        print(f"¡Hola, {args.nombre}! 👋 (#{i+1})")

    return 0

if __name__ == '__main__':
    sys.exit(main())
