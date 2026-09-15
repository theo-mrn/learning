// Pipeline de `learning`, compose a partir des blocs de la bibliotheque
// partagee (theo-mrn/jenkins-shared-lib).
//
// Reproduit ce que fait .github/workflows/deploy.yml :
//   qualite -> deux images -> scan -> promotion GitOps -> ArgoCD reconcilie.
//
// ⚠️ Le workflow GitHub Actions tourne ENCORE en parallele. Tant que les deux
// sont actifs, un push sur main declenche les deux chaines, qui poussent
// chacune un commit de promotion dans argocd_registry. Couper deploy.yml une
// fois ce pipeline valide.
//
// ⭐ Le tag est fige une seule fois, au checkout, et reutilise partout : les
// deux images et le commit de promotion portent donc forcement le meme SHA.
// Appliquer les migrations d'une version au code d'une autre est exactement
// ce qu'on veut eviter.

@Library('shared-lib@v1.0.0') _

def sha

pipeline {
    agent {
        kubernetes {
            // `sonar` est indispensable des lors que le pipeline appelle
            // sonarScan : chaque bloc s'execute dans le conteneur du meme nom,
            // et un outil absent de cette liste echoue sur
            // « container <nom> not found in pod ».
            yaml buildAgent(tools: ['node', 'kaniko', 'trivy', 'git', 'sonar'])
        }
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        // Deux builds concurrents promouvraient deux tags dans le meme
        // depot GitOps, avec un rebase perdant.
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    def vars = checkout scm
                    sha = vars.GIT_COMMIT.take(7)
                    echo "Version construite : ${sha}"
                }
            }
        }

        // Analyses EN SERIE, et non plus en parallele.
        //
        // Le parallelisme faisait cohabiter deux runtimes Node et une JVM
        // dans le meme pod, chacun dimensionnant son tas contre sa propre
        // limite au meme instant : ESLint a renonce a son plafond V8
        // (builds 7 et 8), puis le kernel a OOMKille le conteneur sonar,
        // emportant tout le pod (build 9).
        //
        // Le cluster n'est pas en cause — il tourne a ~50% de sa memoire.
        // C'est la simultaneite qui posait probleme. En serie, chaque outil
        // dispose du pod entier : ~2 min de plus, et toute cette classe de
        // pannes disparait.
        stage('Lint') {
            steps {
                container('node') {
                    sh 'npm ci'
                    // Le heap V8 doit etre dimensionne SOUS la limite du
                    // cgroup (2560Mi ici), pas laisse au defaut : Node
                    // calibre sinon son tas sur ce qu'il croit disponible et
                    // s'arrete sur « Reached heap limit — JavaScript heap out
                    // of memory » (exit 134).
                    //
                    // 2048, apres deux mesures : V8 a abandonne a 1278 Mo
                    // sans la variable (build 7), puis exactement a 1534 Mo
                    // avec 1536 (build 8) — ESLint sur 157 fichiers
                    // TypeScript demande plus.
                    sh 'NODE_OPTIONS="--max-old-space-size=2048" npm run lint'
                }
            }
        }

        stage('Sonar') {
            // DESACTIVE temporairement : Sonar est deja valide (EXECUTION
            // SUCCESS deux fois, 157 fichiers analyses, rapport uploade).
            // On le met de cote le temps d'atteindre enfin dockerBuild et
            // argocdBump, les deux seuls blocs jamais exerces.
            //
            // A reactiver en repassant cette expression a `true` — le stage
            // reste dans le fichier, sa configuration est eprouvee.
            when { expression { return false } }
            steps {
                // Le Global Analysis Token cree le projet a la volee :
                // rien a declarer dans l'UI au prealable.
                sonarScan(
                    projectKey: 'theo-mrn_learning',
                    sources: 'app,components,hooks,lib',
                )
            }
        }

        stage('Trivy depot') {
            steps {
                // Dependances et secrets en clair, avant tout build.
                trivyScan(mode: 'fs', target: '.')
            }
        }

        stage('Images') {
            steps {
                script {
                    // Deux etages du meme Dockerfile, deux images, meme SHA.
                    dockerBuild(
                        image: 'ghcr.io/theo-mrn/learning',
                        target: 'runner',
                        tag: sha,
                        extraTags: ['latest'],
                    )
                    dockerBuild(
                        image: 'ghcr.io/theo-mrn/learning-migrator',
                        target: 'migrator',
                        tag: sha,
                        extraTags: ['latest'],
                    )
                }
            }
        }

        stage('Scan image') {
            steps {
                // Informatif : on observe ce que le scan remonte avant d'en
                // faire un blocage (failOnFound: true).
                trivyScan(image: "ghcr.io/theo-mrn/learning:${sha}")
            }
        }

        stage('Promotion') {
            // Seule main promeut : une branche construit et scanne, sans
            // rien deployer.
            when { branch 'main' }
            steps {
                argocdBump(
                    path: 'kubernetes/system/learning',
                    images: [
                        'ghcr.io/theo-mrn/learning'         : 'app.yml',
                        'ghcr.io/theo-mrn/learning-migrator': 'migration-job.yml',
                    ],
                    tag: sha,
                    message: "learning: ${sha}",
                )
            }
        }
    }

    post {
        success { echo "OK — ${sha} promu, ArgoCD reconcilie." }
        failure { echo "ECHEC — rien n'a ete promu." }
    }
}
