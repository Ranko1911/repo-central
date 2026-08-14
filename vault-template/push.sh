#!/bin/bash

# Preguntar por el comentario
echo "Ingresa el comentario del commit (deja vacío para usar 'autoComment'): "
read comentario

# Usar el comentario ingresado o 'quickFicx' por defecto
if [ -z "$comentario" ]; then
  comentario="autoComment"
fi

# Realizar el commit
git add .
git commit -m "$comentario"
git push origin
