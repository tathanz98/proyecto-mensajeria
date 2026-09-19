import { useState, useRef, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Package,
  Camera,
  CheckCircle,
  X,
  AlertCircle,
  Upload,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PARA SUBIR / TOMAR CADA DOCUMENTO
// ─────────────────────────────────────────────────────────────────────────────

function DocUploader({
  label,
  isSelfie,
  file,
  preview,
  onCapture,
  onFile,
  onClear
}) {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [facingMode, setFacingMode] = useState(
    isSelfie ? 'user' : 'environment'
  );

  const [cameraStarting, setCameraStarting] = useState(false);


  // ───────────────────────────────────────────────────────────────────────────
  // DETENER STREAM
  // ───────────────────────────────────────────────────────────────────────────

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.error('Error deteniendo track:', error);
        }
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (error) {
        // No hacer nada
      }

      videoRef.current.srcObject = null;
    }
  };


  // ───────────────────────────────────────────────────────────────────────────
  // CERRAR CÁMARA
  // ───────────────────────────────────────────────────────────────────────────

  const stopCamera = () => {
    stopStream();

    if (mountedRef.current) {
      setCameraOpen(false);
      setCameraStarting(false);
      setCameraError('');
    }
  };


  // ───────────────────────────────────────────────────────────────────────────
  // LIMPIAR AL DESMONTAR
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.error('Error limpiando cámara:', error);
          }
        });

        streamRef.current = null;
      }

      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch (error) {
          // No hacer nada
        }

        videoRef.current.srcObject = null;
      }
    };
  }, []);


  // ───────────────────────────────────────────────────────────────────────────
  // CONECTAR STREAM AL VIDEO
  //
  // IMPORTANTE:
  // El <video> permanece siempre montado.
  // Solamente cambiamos su srcObject.
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) {
      return;
    }

    let cancelled = false;

    const connectVideo = async () => {
      try {
        if (cancelled) {
          return;
        }

        video.srcObject = stream;

        await video.play();

      } catch (error) {
        if (!cancelled) {
          console.error(
            'Error reproduciendo cámara:',
            error
          );

          if (mountedRef.current) {
            setCameraError(
              'La cámara se abrió, pero no fue posible mostrar la imagen.'
            );
          }
        }
      }
    };

    connectVideo();

    return () => {
      cancelled = true;
    };

  }, [cameraOpen]);


  // ───────────────────────────────────────────────────────────────────────────
  // ABRIR CÁMARA
  // ───────────────────────────────────────────────────────────────────────────

  const startCamera = async (mode = facingMode) => {
    if (cameraStarting) {
      return;
    }

    setCameraError('');
    setCameraStarting(true);

    try {

      // Verificar soporte
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Este navegador no permite acceso directo a la cámara. Usa "Subir Foto".'
        );

        setCameraStarting(false);
        return;
      }


      // Detener cámara anterior
      stopStream();


      // Solicitar cámara
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: mode
            },
            width: {
              ideal: 1280
            },
            height: {
              ideal: 720
            }
          },
          audio: false
        });


      // Si el componente desapareció mientras se solicitaba permiso
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });

        return;
      }


      streamRef.current = stream;

      setFacingMode(mode);
      setCameraOpen(true);
      setCameraError('');
      setCameraStarting(false);

    } catch (error) {

      console.error(
        'Error cámara:',
        error
      );

      if (mountedRef.current) {

        if (error?.name === 'NotAllowedError') {

          setCameraError(
            'Debes permitir el acceso a la cámara en el navegador.'
          );

        } else if (error?.name === 'NotFoundError') {

          setCameraError(
            'No se encontró ninguna cámara disponible.'
          );

        } else if (error?.name === 'NotReadableError') {

          setCameraError(
            'La cámara está siendo utilizada por otra aplicación.'
          );

        } else if (error?.name === 'SecurityError') {

          setCameraError(
            'El navegador bloqueó el acceso a la cámara por seguridad.'
          );

        } else if (error?.name === 'OverconstrainedError') {

          setCameraError(
            'La cámara no admite la configuración solicitada. Intenta nuevamente.'
          );

        } else {

          setCameraError(
            'No fue posible abrir la cámara.'
          );
        }

        setCameraOpen(false);
        setCameraStarting(false);
      }
    }
  };


  // ───────────────────────────────────────────────────────────────────────────
  // TOMAR FOTOGRAFÍA
  // ───────────────────────────────────────────────────────────────────────────

  const takePhoto = () => {

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setCameraError(
        'La cámara no está disponible.'
      );

      return;
    }


    // Verificar que el video tenga imagen
    const width = video.videoWidth;
    const height = video.videoHeight;


    if (!width || !height) {

      setCameraError(
        'La cámara todavía no está lista. Espera un momento y vuelve a intentarlo.'
      );

      return;
    }


    // Preparar canvas
    canvas.width = width;
    canvas.height = height;


    const ctx = canvas.getContext('2d');

    if (!ctx) {

      setCameraError(
        'No se pudo preparar la fotografía.'
      );

      return;
    }


    // Limpiar canvas
    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    // Dibujar fotografía
    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );


    // Crear archivo
    canvas.toBlob(
      (blob) => {

        if (!blob) {

          setCameraError(
            'No se pudo crear la fotografía.'
          );

          return;
        }


        const newFile = new File(
          [blob],
          `${isSelfie ? 'selfie' : 'cedula'}-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
            lastModified: Date.now()
          }
        );


        // Crear preview directamente desde el File
        const previewUrl =
          URL.createObjectURL(newFile);


        // Entregar archivo al componente padre
        onCapture(
          newFile,
          previewUrl
        );


        // Detener cámara
        stopStream();


        if (mountedRef.current) {
          setCameraOpen(false);
          setCameraStarting(false);
          setCameraError('');
        }

      },
      'image/jpeg',
      0.9
    );
  };


  // ───────────────────────────────────────────────────────────────────────────
  // CAMBIAR CÁMARA
  // ───────────────────────────────────────────────────────────────────────────

  const switchCamera = async () => {

    const newMode =
      facingMode === 'user'
        ? 'environment'
        : 'user';


    await startCamera(
      newMode
    );
  };


  // ───────────────────────────────────────────────────────────────────────────
  // SUBIR ARCHIVO
  // ───────────────────────────────────────────────────────────────────────────

  const handleFileChange = (e) => {

    const selectedFile =
      e.target.files?.[0];


    if (!selectedFile) {
      return;
    }


    // Verificar imagen
    if (
      !selectedFile.type ||
      !selectedFile.type.startsWith('image/')
    ) {

      setCameraError(
        'Selecciona una imagen válida.'
      );

      e.target.value = '';

      return;
    }


    // Crear preview
    const previewUrl =
      URL.createObjectURL(
        selectedFile
      );


    // Guardar archivo
    onFile(
      selectedFile,
      previewUrl
    );


    // Permitir seleccionar el mismo archivo nuevamente
    e.target.value = '';

  };


  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        marginBottom: '20px'
      }}
    >

      {/* TÍTULO */}

      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          fontWeight: '600',
          marginBottom: '10px'
        }}
      >
        {label}
      </p>


      {/* INPUT ARCHIVO */}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{
          display: 'none'
        }}
        onChange={handleFileChange}
      />


      {/* CANVAS */}

      <canvas
        ref={canvasRef}
        style={{
          display: 'none'
        }}
      />


      {/* ─────────────────────────────────────────────────────────────────────
          CONTENEDOR DE CÁMARA

          IMPORTANTE:
          Este contenedor y el video permanecen montados.
          No se crean/destruyen dinámicamente.
      ───────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          display: cameraOpen
            ? 'block'
            : 'none',

          borderRadius: '16px',
          overflow: 'hidden',
          background: '#000',
          marginBottom: '12px',
          position: 'relative',
          border: '2px solid var(--primary)'
        }}
      >

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            display: 'block',
            maxHeight: '400px',
            objectFit: 'cover',

            transform:
              isSelfie &&
              facingMode === 'user'
                ? 'scaleX(-1)'
                : 'none'
          }}
        />


        {/* CONTROLES */}

        <div
          style={{
            position: 'absolute',
            bottom: '15px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px'
          }}
        >

          {/* TOMAR FOTO */}

          <button
            type="button"
            onClick={takePhoto}
            disabled={cameraStarting}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '5px solid white',
              background: 'var(--primary)',
              cursor: cameraStarting
                ? 'wait'
                : 'pointer',
              boxShadow:
                '0 4px 20px rgba(0,0,0,0.4)',
              opacity: cameraStarting
                ? 0.5
                : 1
            }}
            title="Tomar foto"
          />


          {/* CAMBIAR CÁMARA */}

          <button
            type="button"
            onClick={switchCamera}
            disabled={cameraStarting}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: 'none',
              background:
                'rgba(0,0,0,0.7)',
              color: 'white',
              cursor: cameraStarting
                ? 'wait'
                : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: cameraStarting
                ? 0.5
                : 1
            }}
            title="Cambiar cámara"
          >
            <RotateCcw size={22} />
          </button>


          {/* CERRAR */}

          <button
            type="button"
            onClick={stopCamera}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: 'none',
              background:
                'rgba(239,68,68,0.9)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Cerrar cámara"
          >
            <X size={22} />
          </button>

        </div>

      </div>


      {/* ─────────────────────────────────────────────────────────────────────
          ERROR
      ───────────────────────────────────────────────────────────────────── */}

      {cameraError && (

        <div
          style={{
            background:
              'rgba(239,68,68,0.1)',
            color: 'var(--danger)',
            padding: '10px',
            borderRadius: '10px',
            marginBottom: '10px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >

          <AlertCircle
            size={16}
            style={{
              flexShrink: 0
            }}
          />

          <span>
            {cameraError}
          </span>

        </div>

      )}


      {/* ─────────────────────────────────────────────────────────────────────
          PREVIEW
      ───────────────────────────────────────────────────────────────────── */}

      {preview && !cameraOpen ? (

        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            border:
              '2px solid var(--primary)'
          }}
        >

          <img
            src={preview}
            alt={label}
            style={{
              width: '100%',
              maxHeight: '240px',
              objectFit: 'cover',
              display: 'block'
            }}
          />


          {/* BOTONES */}

          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              gap: '6px'
            }}
          >

            {/* TOMAR OTRA */}

            <button
              type="button"
              onClick={() =>
                startCamera(
                  facingMode
                )
              }
              title="Tomar otra foto"
              style={{
                background:
                  'rgba(16,185,129,0.9)',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Camera
                size={18}
                color="white"
              />
            </button>


            {/* ELIMINAR */}

            <button
              type="button"
              onClick={() => {

                stopCamera();

                onClear();

              }}
              title="Eliminar foto"
              style={{
                background:
                  'rgba(239,68,68,0.9)',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <X
                size={18}
                color="white"
              />
            </button>

          </div>


          {/* ESTADO */}

          <div
            style={{
              padding: '8px 12px',
              background:
                'rgba(16,185,129,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >

            <CheckCircle
              size={15}
              color="var(--primary)"
            />

            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary)',
                fontWeight: '600'
              }}
            >
              {file?.name || 'Foto lista'}
            </span>

          </div>

        </div>

      ) : !cameraOpen ? (

        /* ───────────────────────────────────────────────────────────────────
           BOTONES CÁMARA / ARCHIVO
        ─────────────────────────────────────────────────────────────────── */

        <div
          style={{
            display: 'flex',
            gap: '10px'
          }}
        >

          {/* CÁMARA */}

          <button
            type="button"
            onClick={() =>
              startCamera(
                isSelfie
                  ? 'user'
                  : 'environment'
              )
            }
            disabled={cameraStarting}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '18px 8px',
              borderRadius: '12px',
              border:
                '2px dashed rgba(16,185,129,0.4)',
              background:
                'rgba(16,185,129,0.05)',
              color: 'var(--text-muted)',
              cursor: cameraStarting
                ? 'wait'
                : 'pointer',
              fontWeight: '600',
              fontSize: '0.82rem',
              opacity: cameraStarting
                ? 0.6
                : 1
            }}
          >

            <Camera
              size={26}
              color="var(--primary)"
            />

            <span>
              {cameraStarting
                ? 'Abriendo cámara...'
                : isSelfie
                  ? 'Tomar Selfie'
                  : 'Tomar Foto'}
            </span>

          </button>


          {/* SUBIR FOTO */}

          <button
            type="button"
            onClick={() =>
              fileRef.current?.click()
            }
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '18px 8px',
              borderRadius: '12px',
              border:
                '2px dashed rgba(99,102,241,0.4)',
              background:
                'rgba(99,102,241,0.05)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.82rem'
            }}
          >

            <Upload
              size={26}
              color="#6366f1"
            />

            <span>
              Subir Foto
            </span>

          </button>

        </div>

      ) : null}

    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL AUTH
// ─────────────────────────────────────────────────────────────────────────────

export default function Auth({ onLogin }) {

  const [isLogin, setIsLogin] =
    useState(true);

  const [registrationStep, setRegistrationStep] =
    useState(1);

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [name, setName] =
    useState('');

  const [vehicle, setVehicle] =
    useState('Moto');

  const [acceptTerms, setAcceptTerms] =
    useState(false);

  const [showTerms, setShowTerms] =
    useState(false);

  const [error, setError] =
    useState(null);


  // ───────────────────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ───────────────────────────────────────────────────────────────────────────

  const [forgotPasswordMode, setForgotPasswordMode] =
    useState(false);

  const [resetStep, setResetStep] =
    useState(1);

  const [resetCode, setResetCode] =
    useState('');

  const [tempToken, setTempToken] =
    useState('');

  const [successMsg, setSuccessMsg] =
    useState('');


  // ───────────────────────────────────────────────────────────────────────────
  // KYC
  // ───────────────────────────────────────────────────────────────────────────

  const [selfieFile, setSelfieFile] =
    useState(null);

  const [selfiePreview, setSelfiePreview] =
    useState(null);

  const [idFrontFile, setIdFrontFile] =
    useState(null);

  const [idFrontPreview, setIdFrontPreview] =
    useState(null);

  const [idBackFile, setIdBackFile] =
    useState(null);

  const [idBackPreview, setIdBackPreview] =
    useState(null);

  const [uploadingDocs, setUploadingDocs] =
    useState(false);


  // ───────────────────────────────────────────────────────────────────────────
  // LOGIN / REGISTRO
  // ───────────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError(null);


    if (
      !isLogin &&
      !acceptTerms
    ) {

      setError(
        'Debes leer y aceptar el contrato de prestación de servicios para continuar.'
      );

      return;
    }


    try {

      const endpoint =
        isLogin
          ? '/login'
          : '/register';


      const body =
        isLogin
          ? {
              email,
              password
            }
          : {
              email,
              password,
              name,
              vehicle,
              role: 'COURIER',
              bankAccount: 'Bancolombia'
            };


      const apiUrl =
        import.meta.env.VITE_API_URL;


      if (!apiUrl) {

        setError(
          'La aplicación no tiene configurada la URL del servidor.'
        );

        return;
      }


      const res =
        await fetch(
          `${apiUrl}/api/auth${endpoint}`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(body)
          }
        );


      const data =
        await res.json()
          .catch(() => ({}));


      if (!res.ok) {

        setError(
          data.error ||
          'Error en la autenticación'
        );

        return;
      }


      localStorage.setItem(
        'token',
        data.token ||
        'demo-token'
      );


      const userId =
        data.userId ||
        data.user?.id ||
        '';


      if (userId) {

        localStorage.setItem(
          'userId',
          String(userId)
        );

      }


      if (isLogin) {

        if (data.user?.isVerified) {

          onLogin();

        } else {

          setRegistrationStep(2);

        }

      } else {

        setRegistrationStep(2);

      }

    } catch (error) {

      console.error(error);

      setError(
        'Error de conexión con el servidor. Verifica tu conexión a Internet.'
      );

    }
  };


  // ───────────────────────────────────────────────────────────────────────────
  // RECUPERAR CONTRASEÑA
  // ───────────────────────────────────────────────────────────────────────────

  const handleForgotPassword =
    async (e) => {

      e.preventDefault();

      setError('');
      setSuccessMsg('');


      try {

        const apiUrl =
          import.meta.env.VITE_API_URL;


        if (!apiUrl) {

          setError(
            'La aplicación no tiene configurada la URL del servidor.'
          );

          return;
        }


        if (resetStep === 1) {

          const res =
            await fetch(
              `${apiUrl}/api/auth/forgot-password`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    email
                  })
              }
            );


          const data =
            await res.json()
              .catch(() => ({}));


          if (res.ok) {

            setSuccessMsg(
              `Código enviado. (Demo - Código: ${data.simulatedCode})`
            );

            setResetStep(2);

          } else {

            setError(
              data.error ||
              'No fue posible enviar el código.'
            );

          }

        } else if (resetStep === 2) {

          const res =
            await fetch(
              `${apiUrl}/api/auth/verify-code`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    email,
                    code: resetCode
                  })
              }
            );


          const data =
            await res.json()
              .catch(() => ({}));


          if (res.ok) {

            setTempToken(
              data.tempToken
            );

            setSuccessMsg(
              'Código verificado. Ingresa tu nueva contraseña.'
            );

            setResetStep(3);

          } else {

            setError(
              data.error ||
              'Código incorrecto.'
            );

          }

        } else if (resetStep === 3) {

          const res =
            await fetch(
              `${apiUrl}/api/auth/reset-password`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    tempToken,
                    newPassword: password
                  })
              }
            );


          const data =
            await res.json()
              .catch(() => ({}));


          if (res.ok) {

            alert(
              '¡Contraseña cambiada! Inicia sesión.'
            );

            setForgotPasswordMode(false);
            setResetStep(1);
            setSuccessMsg('');
            setPassword('');

          } else {

            setError(
              data.error ||
              'No fue posible cambiar la contraseña.'
            );

          }

        }

      } catch (error) {

        console.error(error);

        setError(
          'Error de conexión'
        );

      }
    };


  // ───────────────────────────────────────────────────────────────────────────
  // SUBIR DOCUMENTOS KYC
  // ───────────────────────────────────────────────────────────────────────────

  const handleDocumentUpload =
    async (e) => {

      e.preventDefault();


      if (
        !selfieFile ||
        !idFrontFile ||
        !idBackFile
      ) {

        setError(
          'Debes subir las 3 fotos requeridas.'
        );

        return;
      }


      setUploadingDocs(true);
      setError(null);


      try {

        const apiUrl =
          import.meta.env.VITE_API_URL;


        if (!apiUrl) {

          setError(
            'La aplicación no tiene configurada la URL del servidor.'
          );

          return;
        }


        const userId =
          localStorage.getItem(
            'userId'
          );


        if (!userId) {

          setError(
            'No se encontró el usuario. Vuelve a iniciar sesión.'
          );

          return;
        }


        const formData =
          new FormData();


        formData.append(
          'userId',
          userId
        );


        formData.append(
          'selfie',
          selfieFile
        );


        formData.append(
          'idFront',
          idFrontFile
        );


        formData.append(
          'idBack',
          idBackFile
        );


        const res =
          await fetch(
            `${apiUrl}/api/auth/upload-docs`,
            {
              method: 'POST',
              body: formData
            }
          );


        if (res.ok) {

          setRegistrationStep(3);

        } else {

          const data =
            await res.json()
              .catch(() => ({}));


          setError(
            data.error ||
            'Error al verificar documentos.'
          );
        }

      } catch (error) {

        console.error(error);

        setError(
          'Error de conexión con el servidor.'
        );

      } finally {

        setUploadingDocs(false);

      }
    };


  // ───────────────────────────────────────────────────────────────────────────
  // STEP 2 — KYC
  // ───────────────────────────────────────────────────────────────────────────

  if (registrationStep === 2) {

    const readyCount =
      [
        selfieFile,
        idFrontFile,
        idBackFile
      ].filter(Boolean).length;


    const allReady =
      readyCount === 3;


    return (

      <div
        className="view-container animate-fade-in"
        style={{
          justifyContent: 'flex-start',
          paddingTop: '16px'
        }}
      >

        <div
          className="glass-panel animate-slide-up"
          style={{
            width: '100%',
            padding: '28px 24px'
          }}
        >

          {/* CABECERA */}

          <div
            style={{
              textAlign: 'center',
              marginBottom: '24px'
            }}
          >

            <div
              style={{
                display:
                  'inline-flex',

                padding: '16px',

                borderRadius:
                  '50%',

                background:
                  'rgba(16,185,129,0.15)',

                marginBottom:
                  '14px'
              }}
            >

              <ShieldCheck
                size={40}
                color="var(--primary)"
              />

            </div>


            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: '700',
                marginBottom: '6px'
              }}
            >
              Verificación de Identidad
            </h1>


            <p
              style={{
                color:
                  'var(--text-muted)',

                fontSize:
                  '0.85rem',

                lineHeight:
                  '1.6'
              }}
            >

              Toma una foto con tu cámara
              o sube una imagen.

              <br />

              <strong
                style={{
                  color:
                    'var(--text-main)'
                }}
              >
                Sin cámara
              </strong>

              , usa "Subir Foto"
              desde tu PC o galería.

            </p>

          </div>


          {/* PROGRESO */}

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              fontSize: '0.75rem',
              color:
                'var(--text-muted)',
              marginBottom: '6px'
            }}
          >

            <span>
              Progreso
            </span>

            <span>
              {readyCount} / 3 documentos
            </span>

          </div>


          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '24px'
            }}
          >

            {[
              selfieFile,
              idFrontFile,
              idBackFile
            ].map((f, i) => (

              <div
                key={i}
                style={{
                  flex: 1,
                  height: '5px',
                  borderRadius:
                    '999px',

                  background: f
                    ? 'var(--primary)'
                    : 'rgba(255,255,255,0.1)',

                  transition:
                    'background 0.4s'
                }}
              />

            ))}

          </div>


          {/* ERROR */}

          {error && (

            <div
              style={{
                background:
                  'rgba(239,68,68,0.1)',

                color:
                  'var(--danger)',

                padding:
                  '10px 14px',

                borderRadius:
                  '10px',

                marginBottom:
                  '20px',

                fontSize:
                  '0.875rem',

                display: 'flex',

                alignItems:
                  'center',

                gap: '8px',

                border:
                  '1px solid rgba(239,68,68,0.2)'
              }}
            >

              <AlertCircle
                size={18}
                style={{
                  flexShrink: 0
                }}
              />

              {error}

            </div>

          )}


          <form
            onSubmit={
              handleDocumentUpload
            }
          >

            {/* SELFIE */}

            <DocUploader
              label="1. 🤳 Selfie (foto de tu cara)"
              isSelfie={true}
              file={selfieFile}
              preview={selfiePreview}

              onCapture={(f, url) => {
                setSelfieFile(f);
                setSelfiePreview(url);
              }}

              onFile={(f, url) => {
                setSelfieFile(f);
                setSelfiePreview(url);
              }}

              onClear={() => {
                setSelfieFile(null);
                setSelfiePreview(null);
              }}
            />


            {/* CÉDULA FRONTAL */}

            <DocUploader
              label="2. 🪪 Cédula — Lado Frontal"
              isSelfie={false}
              file={idFrontFile}
              preview={idFrontPreview}

              onCapture={(f, url) => {
                setIdFrontFile(f);
                setIdFrontPreview(url);
              }}

              onFile={(f, url) => {
                setIdFrontFile(f);
                setIdFrontPreview(url);
              }}

              onClear={() => {
                setIdFrontFile(null);
                setIdFrontPreview(null);
              }}
            />


            {/* CÉDULA TRASERA */}

            <DocUploader
              label="3. 🪪 Cédula — Lado Trasero"
              isSelfie={false}
              file={idBackFile}
              preview={idBackPreview}

              onCapture={(f, url) => {
                setIdBackFile(f);
                setIdBackPreview(url);
              }}

              onFile={(f, url) => {
                setIdBackFile(f);
                setIdBackPreview(url);
              }}

              onClear={() => {
                setIdBackFile(null);
                setIdBackPreview(null);
              }}
            />


            {/* INFORMACIÓN */}

            <p
              style={{
                fontSize:
                  '0.78rem',

                color:
                  'var(--text-muted)',

                marginBottom:
                  '20px',

                textAlign:
                  'center',

                lineHeight:
                  '1.5',

                padding:
                  '10px 14px',

                background:
                  'rgba(255,255,255,0.03)',

                borderRadius:
                  '10px',

                border:
                  '1px solid var(--border-color)'
              }}
            >

              💡 Puedes usar la cámara
              o tocar

              <strong
                style={{
                  color:
                    'var(--text-main)',
                  marginLeft:
                    '4px'
                }}
              >
                "Subir Foto"
              </strong>

              para seleccionar
              una imagen desde tu
              computador o galería.

            </p>


            {/* ENVIAR */}

            <button
              type="submit"
              className="btn-primary"
              disabled={
                !allReady ||
                uploadingDocs
              }
              style={{
                width: '100%',

                opacity:
                  !allReady ||
                  uploadingDocs
                    ? 0.4
                    : 1,

                transition:
                  'opacity 0.3s'
              }}
            >

              {uploadingDocs ? (

                <>

                  <RotateCcw
                    size={20}
                    style={{
                      animation:
                        'spin 1s linear infinite'
                    }}
                  />

                  Enviando documentos...

                </>

              ) : (

                <>

                  {allReady
                    ? '✅'
                    : `${readyCount}/3`}

                  Enviar Documentos

                  <ArrowRight
                    size={20}
                  />

                </>

              )}

            </button>

          </form>

        </div>


        <style>
          {`
            @keyframes spin {
              from {
                transform: rotate(0deg);
              }

              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>

      </div>
    );
  }


  // ───────────────────────────────────────────────────────────────────────────
  // STEP 3 — BIENVENIDA
  // ───────────────────────────────────────────────────────────────────────────

  if (registrationStep === 3) {

    return (

      <div
        className="view-container animate-fade-in"
        style={{
          justifyContent:
            'center',

          alignItems:
            'center'
        }}
      >

        <div
          className="glass-panel animate-slide-up"
          style={{
            width: '100%',
            padding: '32px 24px',
            textAlign: 'center'
          }}
        >

          <div
            style={{
              display:
                'inline-flex',

              padding:
                '24px',

              borderRadius:
                '50%',

              background:
                'rgba(16,185,129,0.2)',

              marginBottom:
                '24px'
            }}
          >

            <CheckCircle
              size={64}
              color="var(--primary)"
            />

          </div>


          <h1
            style={{
              fontSize:
                '1.75rem',

              fontWeight:
                '700',

              marginBottom:
                '16px'
            }}
          >
            ¡Bienvenido al Equipo!
          </h1>


          <p
            style={{
              color:
                'var(--text-muted)',

              marginBottom:
                '32px'
            }}
          >
            Tus documentos están en
            revisión rápida.
            Mientras tanto, ya puedes
            configurar tu Billetera y
            prepararte para recibir tu
            primer pedido.
          </p>


          <button
            onClick={onLogin}
            className="btn-primary"
            style={{
              width: '100%'
            }}
          >
            Entrar a la App

            <ArrowRight
              size={20}
            />

          </button>

        </div>

      </div>
    );
  }


  // ───────────────────────────────────────────────────────────────────────────
  // RECUPERAR CONTRASEÑA
  // ───────────────────────────────────────────────────────────────────────────

  if (forgotPasswordMode) {

    return (

      <div
        className="view-container animate-fade-in"
        style={{
          justifyContent:
            'center',

          alignItems:
            'center'
        }}
      >

        <div
          className="glass-panel animate-slide-up"
          style={{
            width: '100%',
            padding: '32px 24px'
          }}
        >

          <div
            style={{
              textAlign:
                'center',

              marginBottom:
                '24px'
            }}
          >

            <ShieldCheck
              size={48}
              color="var(--primary)"
            />

            <h2
              style={{
                marginTop:
                  '16px'
              }}
            >
              Recuperar Contraseña
            </h2>

          </div>


          {error && (

            <div
              style={{
                background:
                  'rgba(239,68,68,0.1)',

                color:
                  'var(--danger)',

                padding:
                  '12px',

                borderRadius:
                  '8px',

                marginBottom:
                  '16px',

                fontSize:
                  '0.9rem',

                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '8px'
              }}
            >

              <AlertCircle
                size={18}
              />

              {error}

            </div>

          )}


          {successMsg && (

            <div
              style={{
                background:
                  'rgba(16,185,129,0.1)',

                color:
                  'var(--primary)',

                padding:
                  '12px',

                borderRadius:
                  '8px',

                marginBottom:
                  '16px',

                fontSize:
                  '0.9rem'
              }}
            >
              {successMsg}
            </div>

          )}


          <form
            onSubmit={
              handleForgotPassword
            }
          >

            {resetStep === 1 && (

              <div
                className="input-group"
              >

                <label>
                  Correo Electrónico
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder="tu@correo.com"
                  required
                  className="input-field"
                />

              </div>

            )}


            {resetStep === 2 && (

              <div
                className="input-group"
              >

                <label>
                  Código de 6 dígitos
                </label>

                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) =>
                    setResetCode(
                      e.target.value
                    )
                  }
                  placeholder="Ej: 123456"
                  maxLength={6}
                  required
                  className="input-field"
                  style={{
                    letterSpacing:
                      '4px',

                    textAlign:
                      'center',

                    fontSize:
                      '1.2rem'
                  }}
                />

              </div>

            )}


            {resetStep === 3 && (

              <div
                className="input-group"
              >

                <label>
                  Nueva Contraseña
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  required
                  className="input-field"
                />

              </div>

            )}


            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                marginTop:
                  '24px'
              }}
            >

              {resetStep === 1
                ? 'Enviar Código'
                : resetStep === 2
                  ? 'Verificar Código'
                  : 'Restablecer'}

            </button>


            <button
              type="button"
              onClick={() => {

                setForgotPasswordMode(
                  false
                );

                setResetStep(1);

                setError('');

                setSuccessMsg('');

              }}
              style={{
                background:
                  'none',

                border:
                  'none',

                width:
                  '100%',

                marginTop:
                  '12px',

                color:
                  'var(--text-muted)',

                cursor:
                  'pointer'
              }}
            >
              Volver al inicio de sesión
            </button>

          </form>

        </div>

      </div>
    );
  }


  // ───────────────────────────────────────────────────────────────────────────
  // STEP 1 — LOGIN / REGISTRO
  // ───────────────────────────────────────────────────────────────────────────

  return (

    <div
      className="view-container animate-fade-in"
      style={{
        justifyContent:
          'center',

        alignItems:
          'center'
      }}
    >

      <div
        className="glass-panel animate-slide-up"
        style={{
          width: '100%',
          padding: '32px 24px',
          textAlign: 'center'
        }}
      >

        {/* LOGO */}

        <div
          style={{
            display:
              'inline-flex',

            padding:
              '16px',

            borderRadius:
              '50%',

            background:
              'rgba(16,185,129,0.2)',

            marginBottom:
              '24px'
          }}
        >

          <Package
            size={48}
            color="var(--primary)"
          />

        </div>


        <h1
          style={{
            fontSize:
              '1.75rem',

            fontWeight:
              '700',

            marginBottom:
              '8px'
          }}
        >
          {isLogin
            ? 'Bienvenido de nuevo'
            : 'Únete al equipo'}
        </h1>


        <p
          style={{
            color:
              'var(--text-muted)',

            marginBottom:
              '32px'
          }}
        >
          {isLogin
            ? 'Inicia sesión para comenzar a repartir'
            : 'Crea tu cuenta de repartidor'}
        </p>


        {/* ERROR */}

        {error && (

          <div
            className="animate-slide-up"
            style={{
              background:
                'rgba(239,68,68,0.1)',

              color:
                'var(--danger)',

              padding:
                '12px 16px',

              borderRadius:
                'var(--radius-md)',

              marginBottom:
                '24px',

              fontSize:
                '0.9rem',

              border:
                '1px solid rgba(239,68,68,0.2)',

              display:
                'flex',

              alignItems:
                'center',

              gap:
                '8px',

              textAlign:
                'left'
            }}
          >

            <AlertCircle
              size={20}
              style={{
                flexShrink:
                  0
              }}
            />

            <span>
              {error}
            </span>

          </div>

        )}


        <form
          onSubmit={
            handleSubmit
          }
        >

          {/* NOMBRE */}

          {!isLogin && (

            <div
              className="input-group"
            >

              <label>
                Nombre Completo
              </label>

              <div
                style={{
                  position:
                    'relative'
                }}
              >

                <User
                  size={20}
                  style={{
                    position:
                      'absolute',

                    left:
                      '12px',

                    top:
                      '14px',

                    color:
                      'var(--text-muted)'
                  }}
                />

                <input
                  type="text"
                  className="input-field"
                  placeholder="Juan Pérez"
                  style={{
                    paddingLeft:
                      '40px'
                  }}
                  required
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          )}


          {/* VEHÍCULO */}

          {!isLogin && (

            <div
              className="input-group"
            >

              <label>
                Tipo de Vehículo
              </label>

              <select
                className="input-field"
                value={vehicle}
                onChange={(e) =>
                  setVehicle(
                    e.target.value
                  )
                }
                style={{
                  width:
                    '100%'
                }}
              >

                <option value="Moto">
                  🏍️ Motocicleta
                </option>

                <option value="Bicicleta">
                  🚲 Bicicleta
                </option>

                <option value="Carro">
                  🚗 Carro
                </option>

              </select>

            </div>

          )}


          {/* EMAIL */}

          <div
            className="input-group"
          >

            <label>
              Correo Electrónico
            </label>

            <div
              style={{
                position:
                  'relative'
              }}
            >

              <Mail
                size={20}
                style={{
                  position:
                    'absolute',

                  left:
                    '12px',

                  top:
                    '14px',

                  color:
                    'var(--text-muted)'
                }}
              />

              <input
                type="email"
                className="input-field"
                placeholder="correo@ejemplo.com"
                style={{
                  paddingLeft:
                    '40px'
                }}
                required
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
              />

            </div>

          </div>


          {/* PASSWORD */}

          <div
            className="input-group"
            style={{
              marginBottom:
                '32px'
            }}
          >

            <label>
              Contraseña
            </label>

            <div
              style={{
                position:
                  'relative'
              }}
            >

              <Lock
                size={20}
                style={{
                  position:
                    'absolute',

                  left:
                    '12px',

                  top:
                    '14px',

                  color:
                    'var(--text-muted)'
                }}
              />

              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                style={{
                  paddingLeft:
                    '40px'
                }}
                required
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
              />

            </div>

          </div>


          {/* CONTRATO */}

          {!isLogin && (

            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '8px',

                marginBottom:
                  '24px',

                textAlign:
                  'left'
              }}
            >

              <input
                type="checkbox"
                id="terms"
                checked={
                  acceptTerms
                }
                onChange={(e) =>
                  setAcceptTerms(
                    e.target.checked
                  )
                }
                required
                style={{
                  width:
                    '18px',

                  height:
                    '18px',

                  accentColor:
                    'var(--primary)',

                  cursor:
                    'pointer'
                }}
              />

              <label
                htmlFor="terms"
                style={{
                  color:
                    'var(--text-muted)',

                  fontSize:
                    '0.85rem',

                  cursor:
                    'pointer'
                }}
              >

                He leído y acepto el{' '}

                <button
                  type="button"
                  onClick={() =>
                    setShowTerms(
                      true
                    )
                  }
                  style={{
                    background:
                      'none',

                    border:
                      'none',

                    color:
                      'var(--primary)',

                    fontWeight:
                      '600',

                    cursor:
                      'pointer',

                    padding:
                      0
                  }}
                >
                  Contrato de Prestación de Servicios
                </button>.

              </label>

            </div>

          )}


          {/* BOTÓN LOGIN */}

          <button
            type="submit"
            className="btn-primary"
            style={{
              width:
                '100%',

              marginBottom:
                '24px'
            }}
          >

            {isLogin
              ? 'Iniciar Sesión'
              : 'Registrarse'}

            <ArrowRight
              size={20}
            />

          </button>

        </form>


        {/* OLVIDÓ CONTRASEÑA */}

        {isLogin && (

          <p
            style={{
              textAlign:
                'center',

              marginBottom:
                '24px',

              fontSize:
                '0.9rem'
            }}
          >

            <button
              type="button"
              onClick={() => {

                setForgotPasswordMode(
                  true
                );

                setError('');

              }}
              style={{
                background:
                  'none',

                border:
                  'none',

                color:
                  'var(--primary)',

                cursor:
                  'pointer',

                textDecoration:
                  'underline'
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>

          </p>

        )}


        {/* CAMBIAR LOGIN / REGISTRO */}

        <div
          style={{
            borderTop:
              '1px solid var(--border-color)',

            paddingTop:
              '24px'
          }}
        >

          <p
            style={{
              color:
                'var(--text-muted)',

              fontSize:
                '0.9rem'
            }}
          >

            {isLogin
              ? '¿No tienes cuenta?'
              : '¿Ya tienes cuenta?'}

            <button
              type="button"
              onClick={() => {

                setIsLogin(
                  !isLogin
                );

                setError(null);

              }}
              style={{
                background:
                  'none',

                border:
                  'none',

                color:
                  'var(--primary)',

                fontWeight:
                  '600',

                marginLeft:
                  '8px',

                cursor:
                  'pointer',

                fontSize:
                  '0.9rem'
              }}
            >
              {isLogin
                ? 'Regístrate aquí'
                : 'Inicia sesión'}
            </button>

          </p>

        </div>

      </div>


      {/* ─────────────────────────────────────────────────────────────────────
          MODAL CONTRATO
      ───────────────────────────────────────────────────────────────────── */}

      {showTerms && (

        <div
          style={{
            position:
              'fixed',

            inset:
              0,

            background:
              'rgba(0,0,0,0.8)',

            zIndex:
              100,

            display:
              'flex',

            justifyContent:
              'center',

            alignItems:
              'center',

            padding:
              '16px'
          }}
        >

          <div
            className="glass-panel animate-slide-up"
            style={{
              width:
                '100%',

              maxWidth:
                '500px',

              maxHeight:
                '80vh',

              display:
                'flex',

              flexDirection:
                'column',

              position:
                'relative'
            }}
          >

            {/* CERRAR */}

            <button
              type="button"
              onClick={() =>
                setShowTerms(
                  false
                )
              }
              style={{
                position:
                  'absolute',

                top:
                  16,

                right:
                  16,

                background:
                  'none',

                border:
                  'none',

                color:
                  'var(--text-muted)',

                cursor:
                  'pointer'
              }}
            >

              <X
                size={24}
              />

            </button>


            <h3
              style={{
                marginBottom:
                  '16px',

                fontSize:
                  '1.2rem',

                padding:
                  '24px 24px 0 24px'
              }}
            >
              Contrato de Prestación de Servicios
            </h3>


            <div
              style={{
                overflowY:
                  'auto',

                padding:
                  '0 24px 24px 24px',

                color:
                  'var(--text-muted)',

                fontSize:
                  '0.9rem',

                lineHeight:
                  '1.6'
              }}
            >

              <p
                style={{
                  marginBottom:
                    '12px'
                }}
              >

                <strong>
                  1. Naturaleza del Contrato:
                </strong>{' '}

                El presente acuerdo es
                de naturaleza comercial
                e independiente. El
                Domiciliario actuará como
                contratista independiente
                y no existirá relación
                laboral con la plataforma.

              </p>


              <p
                style={{
                  marginBottom:
                    '12px'
                }}
              >

                <strong>
                  2. Tarifas y Descuentos:
                </strong>{' '}

                La plataforma deducirá
                un valor fijo de{' '}

                <strong>
                  $5,000 COP
                </strong>{' '}

                por cada servicio
                completado de forma
                exitosa en concepto de
                uso tecnológico.

              </p>


              <p
                style={{
                  marginBottom:
                    '12px'
                }}
              >

                <strong>
                  3. Prestaciones de Ley:
                </strong>{' '}

                El domiciliario autoriza
                expresamente a la
                plataforma para que
                retenga y automatice el
                pago de su seguridad
                social (Salud 4%,
                Pensión 4%) y
                aprovisionamiento de
                prima de servicios.

              </p>


              <p
                style={{
                  marginBottom:
                    '12px'
                }}
              >

                <strong>
                  4. Confidencialidad y Seguridad:
                </strong>{' '}

                El domiciliario se
                compromete a no
                compartir los Códigos
                PIN de seguridad
                proporcionados para la
                recolección y entrega de
                los pedidos bajo ninguna
                circunstancia.

              </p>


              <p>

                Al hacer clic en aceptar,
                confirmas que has leído
                y entendido en su totalidad
                los términos aquí descritos.

              </p>

            </div>


            {/* ACEPTAR */}

            <div
              style={{
                padding:
                  '16px 24px',

                borderTop:
                  '1px solid var(--border-color)'
              }}
            >

              <button
                type="button"
                onClick={() => {

                  setAcceptTerms(
                    true
                  );

                  setShowTerms(
                    false
                  );

                }}
                className="btn-primary"
                style={{
                  width:
                    '100%'
                }}
              >
                Aceptar Contrato
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}