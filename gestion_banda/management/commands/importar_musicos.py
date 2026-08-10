"""
Management command para importar la nomina completa de musicos.
Uso: python manage.py importar_musicos
Es idempotente: salta duplicados y musicos sin CI.
"""
import re
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from gestion_banda.models import Musico, Usuario

NOMINA = [
    # orden, nombres, apellidos, telefono, ci, instrumento, fecha_nac(YYYY-MM-DD), talla_camisa, num_calzado
    # TROMPETAS
    (1,"RAUL","QUINO MARTINEZ","71515970","7302782","TROMPETA","1987-08-03","18","41"),
    (2,"HERIK","MANCILLA CONDORI","78832529","9985470","TROMPETA","1988-07-26","16","39"),
    (3,"ZENON MOISES","HUANCA CATUNTA","71926045","5481666","TROMPETA","1979-10-19","17","40"),
    (4,"ARMANDO","ARUQUIPA VILLCA","77202568","6191666","TROMPETA","1984-11-19","16","40"),
    (5,"IVAR MICHEL","CALLISAYA MAMANI","62418978","6933319","TROMPETA","1999-05-04","15","40"),
    (6,"VICTOR HUGO","PILLCO APAZA","72538205","6941465","TROMPETA","1988-05-20","15","39"),
    (7,"RAMIRO","MAMANI APAZA","79593071","9124763","TROMPETA","1991-02-20","16","39"),
    (8,"DIEGO ALONZO","CORONEL","73045139","8282763","TROMPETA","1998-04-24","15","40"),
    (9,"ABAD JHONNY","TARQUI CALDERON","68045765","11540242","TROMPETA","1995-01-12","16","39"),
    (10,"JUAN PABLO","CHOQUECALLATA M","73849307","4078261","TROMPETA","1983-11-24","18","39"),
    (11,"MARIO","ORELLANA AYALA","67043986","9078618","TROMPETA","1995-05-31","18","41"),
    (13,"CESAR ANTONIO","MAMANI SARZURI","67017191","7085113","TROMPETA","1990-12-20","17","39"),
    (14,"MILTON ARIEL","JULIAN NINA","65138605","13553398","TROMPETA","1995-04-10","16","42"),
    (15,"GUALBERTO","ESCOBAR RAMOS","75879280","9952990","TROMPETA","1999-12-26","16","39"),
    (16,"EDRIAN SIXTO","COARITE POMA","75152354","9882132","TROMPETA","2002-03-03","14","39"),
    (17,"DAVID ZACARIAS","MESTAS","77856498","13246819","TROMPETA","2003-12-07","16","38"),
    (18,"EDWIN","QUISPECAHUANA FERNANDEZ","68821338","7089057","TROMPETA","1990-07-19","16","40"),
    (19,"RENE","SIANCAS ACOSTA","75954049","6516019","TROMPETA","1988-05-22","16","40"),
    (22,"HANZ","VILLA TORREZ","65655487","12510294","TROMPETA","2004-07-19","16","39"),
    (23,"JULIO CESAR","POMA LIMA","72529293","6069386","TROMPETA","1986-04-12","16","39"),
    (24,"FROILAN JHUNIOR","YUPANQUI RAMOS","68115566","6071525","TROMPETA","1997-07-15","16","39"),
    (25,"WILSON DANIEL","CONDORCET HUAYLLANI","73517561","13627268","TROMPETA","2002-02-23","14","40"),
    (26,"BENJAMIN","OSCO CORONEL","72071929","9945664","TROMPETA","1993-11-04","15","39"),
    (27,"JERRY","QUISPE CRUZ","70133965","6966806","TROMPETA","1992-06-04","16","40"),
    (28,"ESTEBAN","QUISPE TICONA","75231418","9992819","TROMPETA","1998-05-11","16","39"),
    (29,"JESUS","CALLISAYA MENDOZA","73309631","12361459","TROMPETA","2003-11-19","15","40"),
    (31,"JUAN MIGUEL","QUISPE CHOQUE","60542827","13491943","TROMPETA","2004-12-18","",""),
    (32,"FREDDY ANGELO","MAMANI CHOQUE","76503281","6118533","TROMPETA","2000-07-06","",""),
    # CLARINETES Y SAXOS
    (2,"EFRAIN","CALLISAYA","77253812","7082114","SAXOFON","1989-02-01","15","38"),
    (3,"DEYBIS","QUISPE","68173763","15621203","CLARINETE","2003-05-31","14","37"),
    (4,"MIGUEL ANGEL","BALBOA MOYA","69869205","10097903","CLARINETE","1997-05-01","15","37"),
    (5,"EDWIN FELIX","CHUQUIMIA GUTIERREZ","70158599","8262629","SAXOFON","1986-06-20","16","39"),
    (6,"ELIAN NACHO","GUTIERREZ","75807381","13734737","SAXOFON","2002-04-08","15","40"),
    (7,"SERGIO","FLORES QUISBERT","67306312","6750127","SAXOFON","1996-09-03","15","41"),
    (8,"ROCIO ELIANA","CONDORI PAIVA","76584985","9915263","SAXOFON","1998-07-20","16","35"),
    (9,"JESSICA","PARRA COLQUEHUANCA","67649385","12514841","SAXOFON","1998-10-03","16","38"),
    (10,"RONALD","ESQUIVEL PINTO","69174902","10062753","CLARINETE","2003-05-01","15","39"),
    # BARITONO
    (2,"VLADIMIR","PARIAMO CORONEL","73078489","6892247","BARITONO","1993-08-05","17","40"),
    (3,"FRANZ","MONASTERIOS CONDORI","73522102","12510285","BARITONO","1999-01-22","16","39"),
    (4,"JOSE LUIS","MAMANI BURGOA","75242665","9910972","BARITONO","1996-12-02","18","41"),
    (5,"RUBEN","ARIAS FLORES","71936816","7073611","BARITONO","1993-10-25","17","41"),
    (6,"ENRIQUE","TARQUI CHOQUEHUANCA","67064288","13085390","BARITONO","1998-11-15","15","38"),
    (7,"REYNALDO BORIS","COLQUE CONDORI","73568955","9940417","BARITONO","1997-04-22","17","41"),
    (8,"RODNY JOEL","TININI LIMACHI","73276810","13676904","BARITONO","2004-03-10","16","40"),
    (9,"EDWIN","MAMANI CATARI","75252108","6056403","BARITONO","1983-12-04","17","40"),
    (10,"PEDRO","OJEDA QUISPE","70204467","9257364","BARITONO","1966-10-19","17","39"),
    (11,"LUIS ALFREDO","QUISPE ESQUIVEL","73591973","7031765","BARITONO","1988-08-19","17","41"),
    (12,"KEVIN","CALLISAYA VILA","72053578","13217139","BARITONO","2002-01-22","16","41"),
    (13,"OSCAR RAMIRO","NINA CORDOVA","67064890","8576591","BARITONO","1993-02-07","14","39"),
    (16,"JUAN DANIEL","MEDINA CASTILLO","69984526","13677292","BARITONO","2006-05-07","15","41"),
    (17,"CARLOS MOISES","LOPEZ SUCASACA","60627675","9118350","BARITONO","1996-10-02","15","40"),
    (18,"FAVIO","NINA SANCHEZ","71943745","6046829","BARITONO","1983-11-19","17","41"),
    (19,"JOSE FERNANDO","MARCA VALENCIA","68147675","8464215","BARITONO","2002-03-11","15","39"),
    (22,"BRYAN MIGUEL","MAYTA CONDORI","73571259","13921153","BARITONO","1998-05-01","16","40"),
    (23,"ADHEMAR","GUTIERREZ QUISPE","72589492","10945501","BARITONO","1996-09-10","16","40"),
    (24,"ELVIS ANGEL","BAUTISTA GUTIERREZ","74058562","6932711","BARITONO","1998-07-02","16","39"),
    (25,"RAFO","VILA HUANCA","71721117","7008951","BARITONO","1987-11-12","",""),
    (26,"BRAYAN IVAN","FERNANDEZ MAMANI","67157744","9237751","BARITONO","2000-11-21","16","40"),
    # TROMBON
    (1,"ADAN","QUISPE CHAMBI","68085466","9214481","TROMBON","1999-01-16","15","41"),
    (2,"WLADIMIR","MAMANI HUARACHI","69825910","7309862","TROMBON","1992-11-08","15","40"),
    (3,"EDSSON","MAMANI HUARACHI","78841981","7307208","TROMBON","1994-06-18","15","38"),
    (5,"FIDEL","HERRERA SALINAS","72091745","72091745","TROMBON","1988-04-24","16","39"),
    (6,"JORGE JOEL","GUARACHI RIOS","63220607","11066466","TROMBON","2005-12-14","17","41"),
    (7,"FRANCISCO","ESCOBAR QUISPE","77233528","4369797","TROMBON","1978-06-04","16","38"),
    (9,"JHON CARLOS","CALLE VERA","71280728","14966709","TROMBON","2009-11-04","14","39"),
    (10,"JOEL","ALIAGA GUTIERREZ","63073873","13645209","TROMBON","2001-07-28","15","38"),
    (11,"FRANCISCO ANTONIO","ADUVIRI TITO","72201809","12421639","TROMBON","1995-07-24","16","42"),
    (12,"HUMBERTO","CONDORI YUJRA","76224724","4362388","TROMBON","1975-09-07","17","39"),
    (13,"JOSE","PATY CUSI","78976513","13967080","TROMBON","2003-06-14","14","37"),
    # TUBA
    (1,"JHONNY","CALLE CAYO","71926380","3551289","TUBA","1977-11-29","19","41"),
    (2,"KEVIN CRISTIAN","MIRANDA HERRERA","77760124","12989092","TUBA","2001-09-16","16","40"),
    (3,"RONALD","RIVAS HUALLPA","76219902","14006844","TUBA","2004-04-16","16","40"),
    (5,"PEDRO PASCUAL","CALLISAYA NINA","64187071","12453092","TUBA","2007-07-29","17","40"),
    (6,"CHRISTIAN ALFREDO","GARNICA ONORI","70557148","12420934","TUBA","1997-12-27","15","40"),
    (7,"WILSON","QUISPE SALAS","72544770","7056366","TUBA","1992-01-05","16","39"),
    (8,"PAUL ANGEL","ALCON CHURA","72927676","13605878","TUBA","2002-09-03","16","41"),
    (9,"NOEL HANOVER","ORELLANA JAUREGUI","68012760","14675659","TUBA","2005-12-07","15","41"),
    (10,"GROVER RUBEN","QUISPE MARCANI","68114212","9901032","TUBA","1996-11-20","17","42"),
    (11,"ARIEL","RIVAS HUALLPA","72570651","14007017","TUBA","2006-03-13","16","41"),
    (12,"OSCAR GONZALO","ONORI","67160167","6724270","TUBA","1991-01-10","16","40"),
    (13,"ROGER","LARUTA RONQUILLO","72929771","9871301","TUBA","1989-09-24","",""),
    # BOMBO
    (1,"JOSE LUIS","DURAN MAMANI","73276073","6068138","BOMBO","1984-03-18","17","38"),
    (2,"JUAN MARCOS","RAMIREZ MARCE","69804818","9094767","BOMBO","1999-09-30","15","39"),
    (3,"OSMAR MIGUEL","CATARI QUIROGA","76202303","9258902","BOMBO","2006-05-21","15","39"),
    (4,"CRICENCIO","TICONA SUNAVI","67046201","6083690","BOMBO","1980-03-13","16","39"),
    (5,"BRIAN","MAMANI TONCONI","74270572","12636943","BOMBO","2000-07-12","15","38"),
    (7,"JORGE LUIS","MAMANI APAZA","70134043","8334823","BOMBO","1992-10-16","15","38"),
    (8,"DENNIS JESUS","ALIAGA GUTIERREZ","62579277","12515093","BOMBO","2007-03-16","14","39"),
    # TAMBOR
    (1,"ELIAS DANIEL","VARGAS PAREDES","64104439","13815693","TAMBOR","2005-02-21","14","39"),
    (2,"ADHEMAR WILLIAMS","CHOQUE LOPEZ","63177813","9230626","TAMBOR","1999-09-10","15","39"),
    (3,"EDY","LAURA QUISPE","63070421","6967337","TAMBOR","1999-10-10","14","37"),
    (5,"CELSO JHAMIL","GONZALES CRUZ","60686677","9972402","TAMBOR","2005-03-16","15","40"),
    (6,"DEYMAR ALI","PACASI","68131469","10945786","TAMBOR","1998-07-23","14","39"),
    (7,"JUAN PEDRO","COMPARA PATTY","73268908","9886466","TAMBOR","1992-06-16","",""),
    (8,"JOHNNY ERLAND","CALLE VERA","60645347","9894995","TAMBOR","2002-04-20","",""),
    # PLATILLOS
    (1,"JUAN MANUEL","SALAZAR MAMANI","75820367","9241067","PLATILLOS","1996-06-15","16","41"),
    (2,"ANGEL","VARGAS","64114305","14154369","PLATILLOS","2001-02-28","14","39"),
    (3,"FRANZ SAUL","SALAZAR HUALLPARA","72031443","12361439","PLATILLOS","1996-09-11","15","39"),
    (4,"WILSON","MAMANI ALIAGA","73282946","9926637","PLATILLOS","2001-04-28","15","39"),
    (5,"IVER","POMA CONDE","63157335","13055040","PLATILLOS","2002-01-27","15","40"),
    (6,"LISMER EDUARDO","POMA CONDE","69943580","14912710","PLATILLOS","2007-03-23","15","39"),
]


class Command(BaseCommand):
    help = 'Importa la nomina completa de musicos. Salta duplicados y musicos sin CI.'

    def handle(self, *args, **options):
        creados = 0
        omitidos = 0
        errores = []

        self.stdout.write('=' * 55)
        self.stdout.write('Importando nomina - Banda Mejillones...')
        self.stdout.write('=' * 55)

        with transaction.atomic():
            for i, fila in enumerate(NOMINA):
                (orden, nombres, apellidos, telefono, ci_raw,
                 instrumento, fecha_nac, talla_camisa, numero_calzado) = fila

                nombres = nombres.strip()
                apellidos = apellidos.strip()
                ci = re.sub(r'[^0-9]', '', ci_raw.strip()) if ci_raw else ''
                nombre_completo = f'{nombres} {apellidos}'.strip()

                if not ci:
                    continue

                if Musico.objects.filter(
                    nombres=nombres, apellidos=apellidos, instrumento=instrumento
                ).exists():
                    self.stdout.write(f'  [YA EXISTE] {nombre_completo}')
                    omitidos += 1
                    continue

                try:
                    pin = ci[:4]
                    username = ci
                    if Usuario.objects.filter(username=username).exists():
                        username = f'{ci}_{i}'

                    usuario = Usuario.objects.create(
                        username=username,
                        first_name=nombres,
                        last_name=apellidos,
                        rol='MUSICO',
                        is_active=True
                    )
                    usuario.set_password(pin)
                    usuario.save()

                    fecha_obj = None
                    if fecha_nac:
                        try:
                            p = fecha_nac.split('-')
                            fecha_obj = date(int(p[0]), int(p[1]), int(p[2]))
                        except Exception:
                            pass

                    Musico.objects.create(
                        usuario=usuario,
                        documento_identidad=ci,
                        nombres=nombres,
                        apellidos=apellidos,
                        telefono=telefono,
                        instrumento=instrumento,
                        nivel='INTERMEDIO',
                        fecha_nacimiento=fecha_obj,
                        talla_camisa=str(talla_camisa) if talla_camisa else '',
                        numero_calzado=str(numero_calzado) if numero_calzado else '',
                        activo=True,
                        orden=i + 1,
                    )

                    self.stdout.write(
                        f'  [OK] {nombre_completo:40s} {instrumento:10s} PIN={ci[:4]}'
                    )
                    creados += 1

                except Exception as e:
                    msg = f'  [ERROR] {nombre_completo}: {e}'
                    self.stdout.write(self.style.ERROR(msg))
                    errores.append(msg)

        self.stdout.write('=' * 55)
        self.stdout.write(
            self.style.SUCCESS(
                f'COMPLETADO: Creados={creados} | Ya existian={omitidos} | Errores={len(errores)}'
            )
        )
